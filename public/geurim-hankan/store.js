(function bootGeurimNetworkStore(global) {
  "use strict";

  var VERSION = 2;
  var STORAGE_KEY = "geurim-hankan:network:v2";
  var API_PREFIX = "/api/geurim-hankan";
  var DEMO_CODE = "DRAW24";
  var CODE_LENGTH = 6;
  var POLL_INTERVAL_MS = 4000;
  var REQUEST_TIMEOUT_MS = 12000;
  var REACTION_TYPES = ["heart", "sparkle", "laugh", "tear", "clap"];

  var listeners = new Set();
  var pollTimer = 0;
  var refreshRequests = {};
  var writeEpochs = {};
  var clientState = readClientState();
  var state = {
    version: VERSION,
    profile: clientState.profile,
    rooms: {},
    activeRoom: clientState.activeRoom,
    drafts: clientState.drafts,
    meta: {
      isLocalOnly: false,
      syncStatus: "idle",
    },
  };
  var sessions = clientState.sessions;
  var snapshotCache = null;

  state.rooms[DEMO_CODE] = createDemoRoom(Date.now());
  if (clientState.cachedRoom && clientState.cachedRoom.code !== DEMO_CODE) {
    state.rooms[clientState.cachedRoom.code] = clientState.cachedRoom;
  }
  restoreDemoProfile();
  refreshSnapshot();
  setupVisibilityPolling();

  var readyPromise = initialize();

  function StoreError(code, message, status) {
    this.name = "GeurimStoreError";
    this.code = code || "UNKNOWN_ERROR";
    this.message = message || "요청을 처리하지 못했어요.";
    this.status = Number(status || 0);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, StoreError);
    }
  }

  StoreError.prototype = Object.create(Error.prototype);
  StoreError.prototype.constructor = StoreError;

  function fail(code, message, status) {
    throw new StoreError(code, message, status);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cloneJson(value) {
    if (value === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      fail("NOT_SERIALIZABLE", "저장할 수 없는 데이터가 포함되어 있어요.");
    }
  }

  function safeText(value, fallback) {
    if (typeof value !== "string") return fallback;
    var result = value.trim();
    return result || fallback;
  }

  function normalizeCode(value) {
    if (typeof value !== "string") return "";
    return value.toUpperCase().replace(/[\s\u2013\u2014-]+/g, "");
  }

  function assertCode(value) {
    var code = normalizeCode(value);
    if (!new RegExp("^[A-Z0-9]{" + CODE_LENGTH + "}$").test(code)) {
      fail("INVALID_CODE", "초대코드는 영문과 숫자 6자리여야 해요.");
    }
    return code;
  }

  function normalizeNickname(value) {
    var nickname = safeText(value, "");
    if (nickname.length < 2 || nickname.length > 12) {
      fail("INVALID_NICKNAME", "닉네임은 2자 이상 12자 이하로 입력해 주세요.");
    }
    return nickname;
  }

  function normalizeColor(value) {
    var color = safeText(value, "#F36B5B");
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      fail("INVALID_COLOR", "프로필 색상을 다시 골라 주세요.");
    }
    return color.toUpperCase();
  }

  function normalizeRoomName(value, nickname) {
    var name = safeText(value, nickname + "의 그림방");
    if (name.length > 30) {
      fail("INVALID_ROOM_NAME", "방 이름은 30자 이하로 입력해 주세요.");
    }
    return name;
  }

  function normalizeSchedule(value, strict) {
    var schedule = typeof value === "string" ? { kind: value } : value;
    if (!isObject(schedule)) {
      if (strict) fail("INVALID_SCHEDULE", "공유 주기를 다시 확인해 주세요.");
      return { kind: "daily", time: "21:00" };
    }
    if (schedule.kind === "hourly") return { kind: "hourly" };
    if (schedule.kind === "daily") {
      var time = typeof schedule.time === "string" ? schedule.time : "21:00";
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        if (strict) fail("INVALID_SCHEDULE", "공유 시간은 HH:MM 형식이어야 해요.");
        time = "21:00";
      }
      return { kind: "daily", time: time };
    }
    if (strict) fail("INVALID_SCHEDULE", "공유 주기를 다시 확인해 주세요.");
    return { kind: "daily", time: "21:00" };
  }

  function normalizeCaption(value) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
      fail("INVALID_CAPTION", "일기 내용은 문자열이어야 해요.");
    }
    var caption = value.trim();
    if (caption.length > 300) {
      fail("INVALID_CAPTION", "일기는 300자 이하로 작성해 주세요.");
    }
    return caption;
  }

  function normalizeStrokes(value) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) {
      fail("INVALID_STROKES", "그림 데이터를 다시 확인해 주세요.");
    }
    return cloneJson(value);
  }

  function normalizeReactionType(value) {
    var type = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (REACTION_TYPES.indexOf(type) === -1) {
      fail("INVALID_REACTION", "사용할 수 없는 반응이에요.");
    }
    return type;
  }

  function normalizeTimestamp(value) {
    if (Number.isFinite(value)) return value;
    var parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function normalizeMember(value) {
    if (!isObject(value) || typeof value.id !== "string" || !value.id) return null;
    var nickname = safeText(value.nickname, "방 멤버").slice(0, 12);
    var color =
      typeof value.color === "string" && /^#[0-9A-F]{6}$/i.test(value.color)
        ? value.color.toUpperCase()
        : "#8B817A";
    return {
      id: value.id,
      nickname: nickname,
      color: color,
    };
  }

  function normalizeReaction(value) {
    if (!isObject(value) || typeof value.type !== "string") return null;
    var type = value.type.trim().toLowerCase();
    if (REACTION_TYPES.indexOf(type) === -1) return null;
    return {
      type: type,
      count: Math.max(0, Math.floor(Number(value.count) || 0)),
      mine: Boolean(value.mine),
    };
  }

  function normalizeEntry(value) {
    if (!isObject(value) || typeof value.id !== "string" || !value.id) return null;
    var reactions = Array.isArray(value.reactions)
      ? value.reactions.map(normalizeReaction).filter(Boolean)
      : [];
    if (!reactions.some(function hasHeart(reaction) {
      return reaction.type === "heart";
    })) {
      reactions.unshift({ type: "heart", count: 0, mine: false });
    }
    return {
      id: value.id,
      memberId:
        typeof value.memberId === "string" && value.memberId
          ? value.memberId
          : "unknown-member",
      caption: typeof value.caption === "string" ? value.caption.slice(0, 300) : "",
      strokes: Array.isArray(value.strokes) ? cloneJson(value.strokes) : [],
      createdAt: normalizeTimestamp(value.createdAt),
      reactions: reactions,
    };
  }

  function normalizeRoom(value, forceDemo) {
    if (!isObject(value)) return null;
    var code = normalizeCode(value.code);
    if (!new RegExp("^[A-Z0-9]{" + CODE_LENGTH + "}$").test(code)) return null;
    var members = Array.isArray(value.members)
      ? value.members.map(normalizeMember).filter(Boolean)
      : [];
    var entries = Array.isArray(value.entries)
      ? value.entries.map(normalizeEntry).filter(Boolean)
      : [];
    entries.sort(function newestFirst(left, right) {
      return right.createdAt - left.createdAt;
    });
    var isDemo = Boolean(forceDemo || value.isDemo || code === DEMO_CODE);
    return {
      code: code,
      name: safeText(value.name, "우리의 그림 한 칸").slice(0, 30),
      schedule: normalizeSchedule(value.schedule, false),
      members: members,
      entries: entries,
      isLocalOnly: isDemo,
      isDemo: isDemo || undefined,
    };
  }

  function normalizeDraft(value) {
    if (!isObject(value)) return null;
    return {
      caption:
        typeof value.caption === "string" ? value.caption.slice(0, 300) : "",
      strokes: Array.isArray(value.strokes) ? cloneJson(value.strokes) : [],
      updatedAt: normalizeTimestamp(value.updatedAt),
    };
  }

  function normalizeSession(value) {
    if (
      !isObject(value) ||
      typeof value.memberId !== "string" ||
      !value.memberId ||
      typeof value.token !== "string" ||
      value.token.length < 16 ||
      value.token.length > 512 ||
      /[\r\n]/.test(value.token)
    ) {
      return null;
    }
    return {
      memberId: value.memberId,
      token: value.token,
      nickname: safeText(value.nickname, "").slice(0, 12),
      color:
        typeof value.color === "string" && /^#[0-9A-F]{6}$/i.test(value.color)
          ? value.color.toUpperCase()
          : "#F36B5B",
    };
  }

  function getLocalStorage() {
    try {
      return global.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function readClientState() {
    var fallback = {
      profile: null,
      activeRoom: null,
      sessions: {},
      drafts: {},
      cachedRoom: null,
    };
    var storage = getLocalStorage();
    if (!storage) return fallback;
    try {
      var parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      if (!isObject(parsed) || parsed.version !== VERSION) return fallback;
      var result = {
        profile: normalizeMember(parsed.profile),
        activeRoom: normalizeCode(parsed.activeRoom),
        sessions: {},
        drafts: {},
        cachedRoom: normalizeRoom(parsed.cachedRoom, false),
      };
      var rawSessions = isObject(parsed.sessions) ? parsed.sessions : {};
      Object.keys(rawSessions).forEach(function keepSession(rawCode) {
        var code = normalizeCode(rawCode);
        var session = normalizeSession(rawSessions[rawCode]);
        if (code && session) result.sessions[code] = session;
      });
      var rawDrafts = isObject(parsed.drafts) ? parsed.drafts : {};
      Object.keys(rawDrafts).forEach(function keepDraft(rawCode) {
        var code = normalizeCode(rawCode);
        var draft = normalizeDraft(rawDrafts[rawCode]);
        if (code && draft) result.drafts[code] = draft;
      });
      if (
        result.activeRoom !== DEMO_CODE &&
        !result.sessions[result.activeRoom]
      ) {
        result.activeRoom = null;
      }
      return result;
    } catch (error) {
      return fallback;
    }
  }

  function roomForStorage() {
    var code = state.activeRoom;
    if (!code || code === DEMO_CODE || !state.rooms[code]) return null;
    var room = cloneJson(state.rooms[code]);
    room.entries = room.entries.slice(0, 40);
    return room;
  }

  function persistClientState() {
    var storage = getLocalStorage();
    if (!storage) return false;
    var payload = {
      version: VERSION,
      profile: state.profile ? cloneJson(state.profile) : null,
      activeRoom: state.activeRoom,
      sessions: cloneJson(sessions),
      drafts: cloneJson(state.drafts),
      cachedRoom: roomForStorage(),
    };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      try {
        payload.cachedRoom = null;
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return true;
      } catch (fallbackError) {
        return false;
      }
    }
  }

  function demoStroke(color, width, points) {
    return {
      color: color,
      width: width,
      points: points.map(function mapPoint(point) {
        return { x: point[0] / 320, y: point[1] / 320 };
      }),
    };
  }

  function demoEntry(id, memberId, caption, createdAt, strokes, reactions) {
    return {
      id: id,
      memberId: memberId,
      caption: caption,
      strokes: strokes,
      createdAt: createdAt,
      reactions: reactions,
    };
  }

  function createDemoRoom(now) {
    return normalizeRoom(
      {
        code: DEMO_CODE,
        name: "우리들의 한 칸",
        schedule: { kind: "daily", time: "21:00" },
        members: [
          { id: "demo-bomi", nickname: "봄이", color: "#F36B5B" },
          { id: "demo-haru", nickname: "하루", color: "#5E83E6" },
          { id: "demo-maru", nickname: "마루", color: "#51A17D" },
        ],
        entries: [
          demoEntry(
            "demo-entry-3",
            "demo-bomi",
            "퇴근길에 노을이 정말 예뻤어.",
            now - 42 * 60 * 1000,
            [
              demoStroke("#F05A4F", 12, [
                [36, 154],
                [76, 132],
                [116, 148],
                [158, 112],
                [204, 142],
                [276, 116],
              ]),
              demoStroke("#FFB84D", 18, [
                [218, 54],
                [222, 54],
              ]),
              demoStroke("#5C6B85", 7, [
                [32, 182],
                [286, 182],
              ]),
            ],
            [
              { type: "heart", count: 2, mine: false },
              { type: "sparkle", count: 1, mine: false },
            ],
          ),
          demoEntry(
            "demo-entry-2",
            "demo-haru",
            "점심 산책에서 만난 작은 친구.",
            now - 3 * 60 * 60 * 1000,
            [
              demoStroke("#51A17D", 10, [
                [62, 178],
                [74, 122],
                [98, 78],
                [118, 124],
                [132, 178],
              ]),
              demoStroke("#5E83E6", 8, [
                [172, 152],
                [190, 126],
                [214, 128],
                [232, 154],
                [210, 172],
                [184, 170],
                [172, 152],
              ]),
            ],
            [{ type: "heart", count: 1, mine: false }],
          ),
          demoEntry(
            "demo-entry-1",
            "demo-maru",
            "오늘은 따뜻한 차로 천천히 시작했어.",
            now - 25 * 60 * 60 * 1000,
            [
              demoStroke("#D88B3E", 10, [
                [88, 112],
                [94, 168],
                [202, 168],
                [208, 112],
              ]),
              demoStroke("#D88B3E", 8, [
                [208, 124],
                [248, 124],
                [252, 150],
                [210, 154],
              ]),
              demoStroke("#9B72CF", 6, [
                [124, 98],
                [116, 76],
                [132, 58],
              ]),
            ],
            [{ type: "heart", count: 2, mine: false }],
          ),
        ],
        isDemo: true,
      },
      true,
    );
  }

  function restoreDemoProfile() {
    if (state.activeRoom !== DEMO_CODE || !state.profile) return;
    var room = state.rooms[DEMO_CODE];
    var demoMember = {
      id: "demo-local",
      nickname: state.profile.nickname,
      color: state.profile.color,
    };
    var existing = room.members.find(function findMember(member) {
      return member.id === demoMember.id;
    });
    if (existing) {
      existing.nickname = demoMember.nickname;
      existing.color = demoMember.color;
    } else {
      room.members.push(demoMember);
    }
    state.profile = demoMember;
  }

  function buildSnapshot() {
    return {
      version: VERSION,
      profile: state.profile ? cloneJson(state.profile) : null,
      rooms: cloneJson(state.rooms),
      activeRoom: state.activeRoom,
      drafts: cloneJson(state.drafts),
      meta: cloneJson(state.meta),
    };
  }

  function refreshSnapshot() {
    snapshotCache = buildSnapshot();
  }

  function emit(type, source, persisted) {
    refreshSnapshot();
    var detail = {
      type: type,
      source: source || "local",
      persisted: persisted !== false,
      isLocalOnly: type.indexOf("demo-") === 0,
    };
    listeners.forEach(function notify(listener) {
      try {
        listener(snapshotCache, detail);
      } catch (error) {
        global.setTimeout(function rethrow() {
          throw error;
        }, 0);
      }
    });
  }

  function makeId(prefix) {
    var bytes = new Uint8Array(8);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    var suffix = Array.from(bytes)
      .map(function hex(byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
    return prefix + "-" + Date.now().toString(36) + "-" + suffix;
  }

  function errorFallback(status) {
    if (status === 400) return "입력 내용을 다시 확인해 주세요.";
    if (status === 401 || status === 403) return "이 방에 다시 입장해 주세요.";
    if (status === 404) return "해당 초대코드의 방을 찾을 수 없어요.";
    if (status === 409) return "다른 요청과 겹쳤어요. 잠시 후 다시 시도해 주세요.";
    if (status === 429) return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
    return "서버 요청을 처리하지 못했어요.";
  }

  async function request(pathname, options) {
    var settings = options || {};
    var headers = {
      Accept: "application/json",
    };
    if (settings.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (settings.token) {
      headers.Authorization = "Bearer " + settings.token;
    }
    var controller =
      typeof global.AbortController === "function"
        ? new global.AbortController()
        : null;
    var timeout = controller
      ? global.setTimeout(function abortRequest() {
          controller.abort();
        }, REQUEST_TIMEOUT_MS)
      : 0;
    var response;
    try {
      response = await global.fetch(API_PREFIX + pathname, {
        method: settings.method || "GET",
        headers: headers,
        body:
          settings.body === undefined ? undefined : JSON.stringify(settings.body),
        cache: "no-store",
        credentials: "same-origin",
        signal: controller ? controller.signal : undefined,
      });
    } catch (error) {
      if (timeout) global.clearTimeout(timeout);
      fail(
        "NETWORK_ERROR",
        error && error.name === "AbortError"
          ? "서버 응답이 늦어지고 있어요. 다시 시도해 주세요."
          : "인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
      );
    }
    if (timeout) global.clearTimeout(timeout);
    var payload = {};
    if (response.status !== 204) {
      try {
        payload = await response.json();
      } catch (error) {
        payload = {};
      }
    }
    if (!response.ok) {
      var serverError = isObject(payload.error) ? payload.error : {};
      var errorCode =
        typeof serverError.code === "string"
          ? serverError.code
          : typeof payload.code === "string"
            ? payload.code
            : "HTTP_" + response.status;
      var errorMessage =
        typeof serverError.message === "string"
          ? serverError.message
          : typeof payload.error === "string"
            ? payload.error
            : typeof payload.message === "string"
              ? payload.message
              : errorFallback(response.status);
      fail(
        errorCode,
        errorMessage,
        response.status,
      );
    }
    return payload;
  }

  function assertRoom(code) {
    var normalized = assertCode(code);
    var room = state.rooms[normalized];
    if (!room) {
      fail("ROOM_NOT_FOUND", "해당 초대코드의 방을 찾을 수 없어요.");
    }
    return room;
  }

  function assertSession(code) {
    var session = sessions[code];
    if (!session) {
      fail("NOT_A_MEMBER", "이 방에 다시 입장해 주세요.", 401);
    }
    return session;
  }

  function profileForRoom(room, session, fallback) {
    var member = room.members.find(function findMember(candidate) {
      return candidate.id === session.memberId;
    });
    return (
      member || {
        id: session.memberId,
        nickname: session.nickname || fallback.nickname,
        color: session.color || fallback.color,
      }
    );
  }

  function saveSession(code, rawSession, fallbackProfile) {
    var session = normalizeSession({
      memberId: rawSession && rawSession.memberId,
      token: rawSession && rawSession.token,
      nickname: fallbackProfile.nickname,
      color: fallbackProfile.color,
    });
    if (!session) {
      fail("INVALID_SESSION", "방 입장 정보를 받지 못했어요.");
    }
    sessions[code] = session;
    return session;
  }

  function invalidateSession(code, type) {
    delete sessions[code];
    delete state.rooms[code];
    if (state.activeRoom === code) {
      state.activeRoom = null;
      stopPolling();
    }
    var persisted = persistClientState();
    emit(type || "session-expired", "remote", persisted);
  }

  function isTerminalSessionError(error) {
    return Boolean(
      error &&
        (error.status === 401 ||
          error.status === 403 ||
          error.status === 404 ||
          error.code === "NOT_A_MEMBER" ||
          error.code === "ROOM_NOT_FOUND"),
    );
  }

  function roomChanged(left, right) {
    if (!left || !right) return true;
    try {
      return JSON.stringify(left) !== JSON.stringify(right);
    } catch (error) {
      return true;
    }
  }

  function adoptRoom(payload, fallbackProfile, eventType) {
    var room = normalizeRoom(payload && payload.room, false);
    if (!room || room.code === DEMO_CODE) {
      fail("INVALID_RESPONSE", "방 정보를 불러오지 못했어요.");
    }
    var session = saveSession(room.code, payload.session, fallbackProfile);
    state.rooms[room.code] = room;
    state.profile = profileForRoom(room, session, fallbackProfile);
    session.nickname = state.profile.nickname;
    session.color = state.profile.color;
    state.activeRoom = room.code;
    state.meta.syncStatus = "online";
    var persisted = persistClientState();
    emit(eventType, "remote", persisted);
    startPolling();
    return cloneJson(room);
  }

  async function createRoom(options) {
    var input = isObject(options) ? options : {};
    var nickname = normalizeNickname(input.nickname);
    var color = normalizeColor(input.color);
    var name = normalizeRoomName(input.name, nickname);
    var schedule = normalizeSchedule(input.schedule, true);
    var payload = await request("/rooms", {
      method: "POST",
      body: {
        nickname: nickname,
        color: color,
        name: name,
        schedule: schedule,
      },
    });
    return adoptRoom(
      payload,
      { nickname: nickname, color: color },
      "room-created",
    );
  }

  async function joinRoom(options) {
    var input = isObject(options) ? options : {};
    var code = assertCode(input.code);
    var nickname = normalizeNickname(input.nickname);
    var color = normalizeColor(input.color);
    var existing = sessions[code];
    if (existing) {
      try {
        var resumed = await request("/rooms/" + encodeURIComponent(code), {
          token: existing.token,
        });
        resumed.session = {
          memberId: existing.memberId,
          token: existing.token,
        };
        return adoptRoom(
          resumed,
          { nickname: nickname, color: color },
          "room-joined",
        );
      } catch (error) {
        if (
          error.status !== 401 &&
          error.status !== 403 &&
          error.status !== 404
        ) {
          throw error;
        }
      }
      delete sessions[code];
    }
    var payload = await request(
      "/rooms/" + encodeURIComponent(code) + "/join",
      {
        method: "POST",
        body: {
          nickname: nickname,
          color: color,
        },
      },
    );
    return adoptRoom(
      payload,
      { nickname: nickname, color: color },
      "room-joined",
    );
  }

  function openDemo(options) {
    var input = isObject(options) ? options : {};
    var nickname = normalizeNickname(input.nickname);
    var color = normalizeColor(input.color);
    var room = state.rooms[DEMO_CODE];
    var profile = {
      id: "demo-local",
      nickname: nickname,
      color: color,
    };
    var existing = room.members.find(function findMember(member) {
      return member.id === profile.id;
    });
    if (existing) {
      existing.nickname = nickname;
      existing.color = color;
    } else {
      room.members.push(profile);
    }
    stopPolling();
    state.profile = profile;
    state.activeRoom = DEMO_CODE;
    var persisted = persistClientState();
    emit("demo-opened", "local", persisted);
    return cloneJson(room);
  }

  function getRoom(code) {
    var room = state.rooms[normalizeCode(code)];
    return room ? cloneJson(room) : null;
  }

  async function refreshRoom(code) {
    var normalized = assertCode(code);
    if (normalized === DEMO_CODE) return getRoom(normalized);
    var session = assertSession(normalized);
    if (refreshRequests[normalized]) return refreshRequests[normalized];
    var capturedEpoch = writeEpochs[normalized] || 0;
    refreshRequests[normalized] = (async function fetchRoom() {
      try {
        var payload = await request(
          "/rooms/" + encodeURIComponent(normalized),
          { token: session.token },
        );
        var room = normalizeRoom(payload && payload.room, false);
        if (!room || room.code !== normalized) {
          fail("INVALID_RESPONSE", "방 정보를 불러오지 못했어요.");
        }
        if ((writeEpochs[normalized] || 0) !== capturedEpoch) {
          return getRoom(normalized);
        }
        var changed = roomChanged(state.rooms[normalized], room);
        state.rooms[normalized] = room;
        if (state.activeRoom === normalized) {
          state.profile = profileForRoom(room, session, {
            nickname: session.nickname || "방 멤버",
            color: session.color || "#F36B5B",
          });
        }
        state.meta.syncStatus = "online";
        var persisted = persistClientState();
        if (changed) emit("room-refreshed", "remote", persisted);
        else refreshSnapshot();
        return cloneJson(room);
      } catch (error) {
        state.meta.syncStatus =
          error && error.code === "NETWORK_ERROR" ? "offline" : "error";
        refreshSnapshot();
        throw error;
      } finally {
        delete refreshRequests[normalized];
      }
    })();
    return refreshRequests[normalized];
  }

  function replaceEntry(room, entry) {
    var index = room.entries.findIndex(function findEntry(candidate) {
      return candidate.id === entry.id;
    });
    if (index === -1) room.entries.unshift(entry);
    else room.entries.splice(index, 1, entry);
    room.entries.sort(function newestFirst(left, right) {
      return right.createdAt - left.createdAt;
    });
  }

  function publishDemoEntry(room, caption, strokes) {
    var entry = {
      id: makeId("demo-entry"),
      memberId: state.profile.id,
      caption: caption,
      strokes: strokes,
      createdAt: Date.now(),
      reactions: [{ type: "heart", count: 0, mine: false }],
    };
    room.entries.unshift(entry);
    delete state.drafts[room.code];
    var persisted = persistClientState();
    emit("demo-entry-published", "local", persisted);
    return cloneJson(entry);
  }

  async function publishEntry(code, entryInput) {
    var room = assertRoom(code);
    var input = isObject(entryInput) ? entryInput : {};
    var caption = normalizeCaption(input.caption);
    var strokes = normalizeStrokes(input.strokes);
    if (!caption && strokes.length === 0) {
      fail("EMPTY_ENTRY", "글이나 그림을 하나 이상 남겨 주세요.");
    }
    if (room.code === DEMO_CODE) {
      if (!state.profile || state.profile.id !== "demo-local") {
        fail("NOT_A_MEMBER", "샘플 방에 먼저 입장해 주세요.");
      }
      return publishDemoEntry(room, caption, strokes);
    }
    var session = assertSession(room.code);
    writeEpochs[room.code] = (writeEpochs[room.code] || 0) + 1;
    try {
      var payload = await request(
        "/rooms/" + encodeURIComponent(room.code) + "/entries",
        {
          method: "POST",
          token: session.token,
          body: {
            caption: caption,
            strokes: strokes,
          },
        },
      );
      var entry = normalizeEntry(payload && payload.entry);
      if (!entry) fail("INVALID_RESPONSE", "게시된 그림 정보를 받지 못했어요.");
      replaceEntry(room, entry);
      delete state.drafts[room.code];
      state.meta.syncStatus = "online";
      var persisted = persistClientState();
      emit("entry-published", "remote", persisted);
      return cloneJson(entry);
    } catch (error) {
      if (isTerminalSessionError(error)) invalidateSession(room.code);
      throw error;
    }
  }

  function toggleDemoReaction(room, entry, type) {
    var reaction = entry.reactions.find(function findReaction(candidate) {
      return candidate.type === type;
    });
    if (!reaction) {
      reaction = { type: type, count: 0, mine: false };
      entry.reactions.push(reaction);
    }
    reaction.mine = !reaction.mine;
    reaction.count = Math.max(0, reaction.count + (reaction.mine ? 1 : -1));
    var persisted = persistClientState();
    emit("demo-reaction-toggled", "local", persisted);
    return cloneJson(entry);
  }

  async function toggleReaction(code, entryId, rawType) {
    var room = assertRoom(code);
    var type = normalizeReactionType(rawType);
    var entry = room.entries.find(function findEntry(candidate) {
      return candidate.id === entryId;
    });
    if (!entry) {
      fail("ENTRY_NOT_FOUND", "반응을 남길 그림을 찾을 수 없어요.");
    }
    if (room.code === DEMO_CODE) {
      return toggleDemoReaction(room, entry, type);
    }
    var session = assertSession(room.code);
    var current = entry.reactions.find(function findReaction(reaction) {
      return reaction.type === type;
    });
    var active = !(current && current.mine);
    writeEpochs[room.code] = (writeEpochs[room.code] || 0) + 1;
    try {
      var payload = await request(
        "/rooms/" +
          encodeURIComponent(room.code) +
          "/entries/" +
          encodeURIComponent(entry.id) +
          "/reactions/" +
          encodeURIComponent(type),
        {
          method: "PUT",
          token: session.token,
          body: { active: active },
        },
      );
      var updated = normalizeEntry(payload && payload.entry);
      if (!updated) fail("INVALID_RESPONSE", "반응 정보를 받지 못했어요.");
      replaceEntry(room, updated);
      state.meta.syncStatus = "online";
      var persisted = persistClientState();
      emit("reaction-toggled", "remote", persisted);
      return cloneJson(updated);
    } catch (error) {
      if (isTerminalSessionError(error)) invalidateSession(room.code);
      throw error;
    }
  }

  function leaveRoom() {
    var previous = state.activeRoom;
    if (!previous) return null;
    stopPolling();
    state.activeRoom = null;
    var persisted = persistClientState();
    emit("room-left", "local", persisted);
    return previous;
  }

  function getState() {
    return snapshotCache;
  }

  function getSnapshot() {
    return snapshotCache;
  }

  function getDraft(code) {
    var draft = state.drafts[normalizeCode(code)];
    return draft ? cloneJson(draft) : null;
  }

  function setDraft(code, draftInput) {
    var room = assertRoom(code);
    if (
      room.code !== DEMO_CODE &&
      (!state.activeRoom ||
        state.activeRoom !== room.code ||
        !sessions[room.code])
    ) {
      fail("NOT_A_MEMBER", "이 방에 다시 입장해 주세요.");
    }
    var input = isObject(draftInput) ? draftInput : {};
    var draft = {
      caption: normalizeCaption(input.caption),
      strokes: normalizeStrokes(input.strokes),
      updatedAt: Date.now(),
    };
    state.drafts[room.code] = draft;
    var persisted = persistClientState();
    emit("draft-saved", "local", persisted);
    return cloneJson(draft);
  }

  function clearDraft(code) {
    var normalized = assertCode(code);
    if (!state.drafts[normalized]) return false;
    delete state.drafts[normalized];
    var persisted = persistClientState();
    emit("draft-cleared", "local", persisted);
    return true;
  }

  function subscribe(callback) {
    if (typeof callback !== "function") {
      fail("INVALID_SUBSCRIBER", "구독 콜백은 함수여야 해요.");
    }
    listeners.add(callback);
    return function unsubscribe() {
      listeners.delete(callback);
    };
  }

  function stopPolling() {
    if (pollTimer) {
      global.clearInterval(pollTimer);
      pollTimer = 0;
    }
  }

  function pollActiveRoom() {
    var code = state.activeRoom;
    if (
      !code ||
      code === DEMO_CODE ||
      !sessions[code] ||
      (global.document && global.document.visibilityState === "hidden")
    ) {
      return;
    }
    refreshRoom(code).catch(function handlePollError(error) {
      if (isTerminalSessionError(error)) invalidateSession(code);
    });
  }

  function startPolling() {
    stopPolling();
    if (
      !state.activeRoom ||
      state.activeRoom === DEMO_CODE ||
      !sessions[state.activeRoom]
    ) {
      return;
    }
    pollTimer = global.setInterval(pollActiveRoom, POLL_INTERVAL_MS);
  }

  function setupVisibilityPolling() {
    if (!global.document || typeof global.document.addEventListener !== "function") {
      return;
    }
    global.document.addEventListener("visibilitychange", function onVisibility() {
      if (global.document.visibilityState === "hidden") {
        stopPolling();
      } else {
        startPolling();
        pollActiveRoom();
      }
    });
  }

  async function initialize() {
    var code = state.activeRoom;
    if (!code) {
      refreshSnapshot();
      return snapshotCache;
    }
    if (code === DEMO_CODE) {
      restoreDemoProfile();
      refreshSnapshot();
      return snapshotCache;
    }
    if (!sessions[code]) {
      state.activeRoom = null;
      persistClientState();
      refreshSnapshot();
      return snapshotCache;
    }
    try {
      await refreshRoom(code);
    } catch (error) {
      if (isTerminalSessionError(error)) {
        invalidateSession(code, "session-expired");
      }
    }
    if (state.activeRoom === code) startPolling();
    refreshSnapshot();
    return snapshotCache;
  }

  global.GeurimStore = Object.freeze({
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    API_PREFIX: API_PREFIX,
    DEMO_CODE: DEMO_CODE,
    ready: readyPromise,
    createRoom: createRoom,
    joinRoom: joinRoom,
    openDemo: openDemo,
    getRoom: getRoom,
    refreshRoom: refreshRoom,
    publishEntry: publishEntry,
    toggleReaction: toggleReaction,
    leaveRoom: leaveRoom,
    subscribe: subscribe,
    getState: getState,
    getSnapshot: getSnapshot,
    getDraft: getDraft,
    setDraft: setDraft,
    clearDraft: clearDraft,
  });
})(typeof window !== "undefined" ? window : globalThis);
