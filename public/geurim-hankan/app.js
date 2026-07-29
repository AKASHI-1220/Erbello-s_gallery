(function bootGeurimHankan(global) {
  "use strict";

  var COLORS = ["#F36B5B", "#5E83E6", "#51A17D", "#D88B3E", "#9B72CF", "#E25E91"];
  var REACTIONS = {
    heart: { emoji: "🧡", label: "좋아요" },
    sparkle: { emoji: "✨", label: "반짝여요" },
    laugh: { emoji: "😆", label: "재밌어요" },
    tear: { emoji: "🥹", label: "뭉클해요" },
    clap: { emoji: "👏", label: "박수" },
  };

  var store;
  var drawing;
  var currentRoom = null;
  var currentFilter = "today";
  var drawingPad = null;
  var toastTimer = 0;
  var draftTimer = 0;
  var previewCleanups = [];

  function byId(id) {
    return document.getElementById(id);
  }

  function makeElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function initials(name) {
    return String(name || "?").trim().slice(0, 1) || "?";
  }

  function profile() {
    return store.getState().profile || {
      id: "",
      nickname: "",
      color: COLORS[0],
    };
  }

  function formatLongDate() {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date());
  }

  function formatTime(value) {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function isToday(value) {
    var date = new Date(value);
    var now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function scheduleLabel(schedule) {
    if (!schedule || schedule.kind === "hourly") {
      return "매시간 함께 기록";
    }

    var parts = String(schedule.time || "22:00").split(":");
    var hour = Number(parts[0]);
    var minute = parts[1] || "00";
    var period = hour < 12 ? "오전" : "오후";
    return "매일 " + period + " " + (hour % 12 || 12) + ":" + minute;
  }

  function promptForSchedule(schedule) {
    return schedule && schedule.kind === "hourly"
      ? "지금 가장 눈에 들어오는 장면은?"
      : "오늘 가장 오래 머문 장면은?";
  }

  function showToast(message) {
    var toast = byId("toast");
    global.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = global.setTimeout(function hideToast() {
      toast.hidden = true;
    }, 2600);
  }

  function showFormError(form, message) {
    var output = form.querySelector("[data-form-error]");
    if (output) output.textContent = message || "";
  }

  function errorMessage(error, fallback) {
    return error && typeof error.message === "string" ? error.message : fallback;
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function closeAllDialogs() {
    document.querySelectorAll("dialog[open]").forEach(closeDialog);
  }

  function selectedColor(form) {
    var input = form.querySelector('input[name="profileColor"]:checked');
    return input ? input.value : COLORS[0];
  }

  function renderColorOptions() {
    document.querySelectorAll("[data-color-options]").forEach(function renderGroup(group, groupIndex) {
      group.replaceChildren();
      COLORS.forEach(function renderColor(color, colorIndex) {
        var label = makeElement("label");
        var input = makeElement("input");
        var check = makeElement("span", "", "✓");

        label.style.setProperty("--swatch", color);
        input.type = "radio";
        input.name = "profileColor";
        input.value = color;
        input.checked = colorIndex === 0;
        input.setAttribute("aria-label", "프로필 색상 " + (colorIndex + 1));
        if (groupIndex > 0) input.name = "profileColor";
        label.append(input, check);
        group.appendChild(label);
      });
    });
  }

  function hydrateFormProfile(form) {
    var saved = profile();
    var nickname = form.elements.nickname;
    if (nickname && !nickname.value) nickname.value = saved.nickname || "";
    var colorInput = form.querySelector(
      'input[name="profileColor"][value="' + (saved.color || COLORS[0]) + '"]',
    );
    if (colorInput) colorInput.checked = true;
  }

  function showLanding() {
    currentRoom = null;
    closeAllDialogs();
    byId("landingScreen").hidden = false;
    byId("roomScreen").hidden = true;
    document.title = "그림한칸 — 우리끼리 쓰는 그림일기";
  }

  function showRoom(room) {
    if (!room) {
      showLanding();
      return;
    }

    currentRoom = room;
    byId("landingScreen").hidden = true;
    byId("roomScreen").hidden = false;
    document.title = room.name + " · 그림한칸";
    renderRoom();
    global.scrollTo({ top: 0, behavior: "auto" });
  }

  function createAvatar(member, small) {
    var avatar = makeElement("span", "avatar" + (small ? " avatar--small" : ""), initials(member.nickname));
    avatar.style.setProperty("--avatar-color", member.color || "#8B817A");
    avatar.title = member.nickname;
    avatar.setAttribute("aria-label", member.nickname);
    return avatar;
  }

  function getAuthor(room, entry) {
    return (
      room.members.find(function findMember(member) {
        return member.id === entry.memberId;
      }) || { id: entry.memberId, nickname: "방 멤버", color: "#8B817A" }
    );
  }

  function clearPreviewObservers() {
    previewCleanups.forEach(function cleanupPreview(cleanup) {
      if (typeof cleanup === "function") cleanup();
    });
    previewCleanups = [];
  }

  function renderRoom() {
    if (!currentRoom) return;
    var fresh = store.getRoom(currentRoom.code);
    if (!fresh) {
      showLanding();
      return;
    }

    currentRoom = fresh;
    var me = profile();
    var todayEntries = fresh.entries.filter(function onlyToday(entry) {
      return isToday(entry.createdAt);
    });
    var postedMemberIds = new Set(
      todayEntries.map(function memberId(entry) {
        return entry.memberId;
      }),
    );

    byId("roomName").textContent = fresh.name;
    byId("roomMemberCount").textContent =
      fresh.members.length + "명이 함께 그리는 중";
    byId("scheduleBadge").textContent = scheduleLabel(fresh.schedule);
    byId("todayLabel").textContent = formatLongDate();
    byId("feedDate").textContent = formatLongDate();
    byId("composeDate").textContent = formatLongDate();
    byId("promptText").textContent = promptForSchedule(fresh.schedule);
    byId("progressStrong").textContent =
      fresh.members.length + "명 중 " + postedMemberIds.size + "명";
    byId("progressBar").style.width =
      Math.min(100, (postedMemberIds.size / Math.max(fresh.members.length, 1)) * 100) + "%";

    var stack = byId("memberStack");
    stack.replaceChildren();
    fresh.members.slice(0, 5).forEach(function addAvatar(member) {
      stack.appendChild(createAvatar(member, false));
    });

    var statuses = byId("memberStatuses");
    statuses.replaceChildren();
    fresh.members.forEach(function addStatus(member) {
      var item = makeElement("span");
      var dot = makeElement("i", postedMemberIds.has(member.id) ? "is-done" : "");
      var name = document.createTextNode(member.nickname);
      var state = makeElement(
        "small",
        "",
        postedMemberIds.has(member.id) ? "완료" : "기다리는 중",
      );
      dot.style.setProperty("--member-color", member.color);
      item.append(dot, name, state);
      statuses.appendChild(item);
    });

    var myEntry = todayEntries.find(function findMine(entry) {
      return entry.memberId === me.id;
    });
    var entryButton = byId("myEntryButton");
    entryButton.classList.toggle("is-complete", Boolean(myEntry));
    entryButton.querySelector(".my-entry-card__icon").textContent = myEntry ? "✓" : "✎";
    byId("myEntryTitle").textContent = myEntry
      ? "오늘의 한 칸을 채웠어요"
      : "내 한 칸이 비어 있어요";
    byId("myEntryDescription").textContent = myEntry
      ? "한 장 더 남길 수 있어요"
      : "그림 한 장과 한 줄이면 충분해요";

    renderFeed(fresh, todayEntries, postedMemberIds);
  }

  function visibleEntries(room, todayEntries) {
    var me = profile();
    if (currentFilter === "today") return todayEntries;
    if (currentFilter === "mine") {
      return room.entries.filter(function mineOnly(entry) {
        return entry.memberId === me.id;
      });
    }
    return room.entries;
  }

  function renderFeed(room, todayEntries, postedMemberIds) {
    var grid = byId("feedGrid");
    var empty = byId("emptyFeed");
    var entries = visibleEntries(room, todayEntries);
    clearPreviewObservers();
    grid.replaceChildren();

    entries.forEach(function addEntry(entry, index) {
      var card = buildEntryCard(room, entry);
      if (index === 0) card.classList.add("entry-card--featured");
      grid.appendChild(card);
    });

    if (currentFilter === "today" && entries.length > 0) {
      var waitingMembers = room.members.filter(function notPosted(member) {
        return !postedMemberIds.has(member.id);
      });

      if (waitingMembers.length > 0) {
        var waitingCopy =
          waitingMembers.length === 1
            ? waitingMembers[0].nickname + "님의 한 칸을 기다리는 중이에요"
            : waitingMembers[0].nickname +
              " 외 " +
              (waitingMembers.length - 1) +
              "명의 한 칸을 기다리는 중이에요";
        grid.appendChild(makeElement("p", "waiting-summary", waitingCopy));
      }
    }

    empty.hidden = entries.length > 0;
    if (!entries.length && currentFilter === "mine") {
      empty.querySelector("h3").textContent = "아직 내가 남긴 그림이 없어요";
    } else {
      empty.querySelector("h3").textContent = "아직 올라온 한 칸이 없어요";
    }

    global.requestAnimationFrame(function paintEntryPreviews() {
      grid.querySelectorAll("canvas[data-entry-id]").forEach(function paint(canvas) {
        var entry = room.entries.find(function match(candidate) {
          return candidate.id === canvas.dataset.entryId;
        });
        if (entry) previewCleanups.push(drawing.renderPreview(canvas, entry.strokes));
      });
    });
  }

  function buildEntryCard(room, entry) {
    var author = getAuthor(room, entry);
    var card = makeElement("article", "entry-card");
    var header = makeElement("div", "entry-card__header");
    var authorCopy = makeElement("div");
    var canvas = makeElement("canvas", "entry-card__drawing");
    var caption = makeElement("p", "entry-card__caption", entry.caption || "말 없이 남긴 한 칸");
    var footer = makeElement("div", "entry-card__footer");
    var list = makeElement("div", "reaction-list");
    var pickerWrap = makeElement("div", "reaction-picker-wrap");
    var addButton = makeElement("button", "add-reaction");
    var picker = makeElement("div", "reaction-picker");

    authorCopy.append(
      makeElement("b", "", author.nickname),
      makeElement("span", "", formatTime(entry.createdAt)),
    );
    header.append(createAvatar(author, true), authorCopy);

    canvas.dataset.entryId = entry.id;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", (entry.caption || author.nickname + "님의") + " 그림");

    (entry.reactions || []).forEach(function addReaction(reaction) {
      if (!REACTIONS[reaction.type] || (!reaction.count && !reaction.mine)) return;
      var button = makeElement("button", reaction.mine ? "is-mine" : "");
      button.type = "button";
      button.setAttribute("aria-pressed", String(Boolean(reaction.mine)));
      button.setAttribute("aria-label", REACTIONS[reaction.type].label);
      button.append(
        makeElement("span", "", REACTIONS[reaction.type].emoji),
        document.createTextNode(" " + reaction.count),
      );
      button.addEventListener("click", async function react() {
        button.disabled = true;
        try {
          await store.toggleReaction(room.code, entry.id, reaction.type);
        } catch (error) {
          showToast(errorMessage(error, "반응을 남기지 못했어요."));
        } finally {
          button.disabled = false;
        }
      });
      list.appendChild(button);
    });

    addButton.type = "button";
    addButton.innerHTML = '<span aria-hidden="true">☺</span> 반응';
    addButton.setAttribute("aria-expanded", "false");
    picker.hidden = true;
    picker.setAttribute("aria-label", "반응 고르기");
    Object.keys(REACTIONS).forEach(function addPickerReaction(type) {
      var button = makeElement("button", "", REACTIONS[type].emoji);
      button.type = "button";
      button.setAttribute("aria-label", REACTIONS[type].label);
      button.addEventListener("click", async function chooseReaction() {
        button.disabled = true;
        try {
          await store.toggleReaction(room.code, entry.id, type);
        } catch (error) {
          showToast(errorMessage(error, "반응을 남기지 못했어요."));
        } finally {
          button.disabled = false;
        }
      });
      picker.appendChild(button);
    });
    addButton.addEventListener("click", function togglePicker() {
      picker.hidden = !picker.hidden;
      addButton.setAttribute("aria-expanded", String(!picker.hidden));
    });
    pickerWrap.append(addButton, picker);
    footer.append(list, pickerWrap);
    card.append(header, canvas, caption, footer);
    return card;
  }

  function openCompose() {
    if (!currentRoom) return;
    var draft = store.getDraft(currentRoom.code) || { caption: "", strokes: [] };
    byId("composePrompt").textContent = promptForSchedule(currentRoom.schedule);
    byId("captionInput").value = draft.caption || "";
    byId("captionCount").textContent = String((draft.caption || "").length);

    drawingPad = drawing.mountPad(byId("drawingPad"), {
      value: draft.strokes || [],
      onChange: function saveDrawing(strokes) {
        saveDraft(byId("captionInput").value, strokes);
      },
    });
    showFormError(byId("composeForm"), "");
    openDialog(byId("composeDialog"));
  }

  function saveDraft(caption, strokes) {
    if (!currentRoom) return;
    global.clearTimeout(draftTimer);
    draftTimer = global.setTimeout(function persistDraft() {
      try {
        store.setDraft(currentRoom.code, {
          caption: caption,
          strokes: strokes,
        });
      } catch (error) {
        showToast(errorMessage(error, "임시 저장하지 못했어요."));
      }
    }, 120);
  }

  async function handleCreate(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var data = new FormData(form);
    var submitButton = event.submitter;
    showFormError(form, "");
    if (submitButton) submitButton.disabled = true;

    try {
      var kind = String(data.get("scheduleKind") || "daily");
      var room = await store.createRoom({
        nickname: String(data.get("nickname") || ""),
        color: selectedColor(form),
        name: String(data.get("name") || ""),
        schedule:
          kind === "hourly"
            ? { kind: "hourly" }
            : { kind: "daily", time: String(data.get("time") || "22:00") },
      });
      closeDialog(byId("createDialog"));
      showRoom(room);
      showToast("새 그림방을 열었어요");
    } catch (error) {
      showFormError(form, errorMessage(error, "방을 만들지 못했어요."));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function handleJoin(event) {
    event.preventDefault();
    var form = event.currentTarget;
    var data = new FormData(form);
    var submitButton = event.submitter;
    showFormError(form, "");
    if (submitButton) submitButton.disabled = true;

    try {
      var room = await store.joinRoom({
        code: String(data.get("code") || ""),
        nickname: String(data.get("nickname") || ""),
        color: selectedColor(form),
      });
      closeDialog(byId("joinDialog"));
      showRoom(room);
      showToast("‘" + room.name + "’에 들어왔어요");
    } catch (error) {
      showFormError(form, errorMessage(error, "초대코드를 다시 확인해 주세요."));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function enterDemo() {
    var saved = profile();
    try {
      var room = await store.openDemo({
        nickname: saved.nickname || "해나",
        color: saved.color || COLORS[0],
      });
      closeAllDialogs();
      showRoom(room);
    } catch (error) {
      showToast(errorMessage(error, "샘플 방을 열지 못했어요."));
    }
  }

  async function handlePublish(event) {
    event.preventDefault();
    if (!currentRoom || !drawingPad) return;
    var form = event.currentTarget;
    var submitButton = event.submitter;
    var caption = byId("captionInput").value.trim();
    var strokes = drawingPad.getValue();
    showFormError(form, "");
    if (submitButton) submitButton.disabled = true;

    try {
      await store.publishEntry(currentRoom.code, {
        caption: caption,
        strokes: strokes,
      });
      global.clearTimeout(draftTimer);
      drawingPad.setValue([]);
      byId("captionInput").value = "";
      byId("captionCount").textContent = "0";
      closeDialog(byId("composeDialog"));
      currentFilter = "today";
      updateFilterTabs();
      renderRoom();
      showToast("오늘의 한 칸을 함께 놓았어요");
    } catch (error) {
      showFormError(form, errorMessage(error, "그림을 올리지 못했어요."));
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  function openInvite() {
    if (!currentRoom) return;
    byId("inviteRoomName").textContent = currentRoom.name;
    var code = currentRoom.code;
    var codeButton = byId("inviteCodeButton");
    codeButton.replaceChildren(
      makeElement("span", "", code.slice(0, 3)),
      makeElement("i", "", "—"),
      makeElement("span", "", code.slice(3)),
    );
    openDialog(byId("inviteDialog"));
  }

  function copyInviteCode() {
    if (!currentRoom) return;
    var code = currentRoom.code;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(function copied() {
          showToast("초대코드를 복사했어요");
        })
        .catch(function fallback() {
          showToast("초대코드는 " + code + "예요");
        });
    } else {
      showToast("초대코드는 " + code + "예요");
    }
  }

  function updateFilterTabs() {
    document.querySelectorAll("[data-filter]").forEach(function update(tab) {
      var selected = tab.dataset.filter === currentFilter;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    });
  }

  function renderHeroPreviews() {
    var demo = store.getRoom(store.DEMO_CODE);
    if (!demo || !demo.entries.length) return;
    var mapping = {
      rain: demo.entries[1] || demo.entries[0],
      bread: demo.entries[2] || demo.entries[0],
    };
    document.querySelectorAll("canvas[data-demo-drawing]").forEach(function paint(canvas) {
      var entry = mapping[canvas.dataset.demoDrawing] || demo.entries[0];
      drawing.renderPreview(canvas, entry.strokes);
    });
  }

  function bindEvents() {
    byId("createRoomButton").addEventListener("click", function openCreate() {
      var form = byId("createForm");
      hydrateFormProfile(form);
      showFormError(form, "");
      openDialog(byId("createDialog"));
    });

    [byId("joinRoomButton"), byId("headerJoinButton")].forEach(function bindJoin(button) {
      button.addEventListener("click", function openJoin() {
        var form = byId("joinForm");
        hydrateFormProfile(form);
        showFormError(form, "");
        openDialog(byId("joinDialog"));
      });
    });

    byId("demoRoomButton").addEventListener("click", enterDemo);
    byId("joinDemoButton").addEventListener("click", enterDemo);
    byId("createForm").addEventListener("submit", handleCreate);
    byId("joinForm").addEventListener("submit", handleJoin);
    byId("composeForm").addEventListener("submit", handlePublish);
    byId("inviteButton").addEventListener("click", openInvite);
    byId("inviteCodeButton").addEventListener("click", copyInviteCode);
    byId("copyInviteButton").addEventListener("click", copyInviteCode);
    byId("myEntryButton").addEventListener("click", openCompose);

    document.querySelectorAll("[data-open-compose]").forEach(function bindCompose(button) {
      button.addEventListener("click", openCompose);
    });

    document.querySelectorAll("[data-close-dialog]").forEach(function bindClose(button) {
      button.addEventListener("click", function closeParent() {
        closeDialog(button.closest("dialog"));
      });
    });

    document.querySelectorAll("dialog").forEach(function bindBackdrop(dialog) {
      dialog.addEventListener("click", function closeOnBackdrop(event) {
        if (event.target === dialog) closeDialog(dialog);
      });
    });

    byId("leaveRoomButton").addEventListener("click", function leave() {
      store.leaveRoom();
      showLanding();
    });
    byId("brandHomeButton").addEventListener("click", function goHome() {
      store.leaveRoom();
      showLanding();
    });

    document.querySelectorAll("[data-filter]").forEach(function bindFilter(tab) {
      tab.addEventListener("click", function chooseFilter() {
        currentFilter = tab.dataset.filter;
        updateFilterTabs();
        renderRoom();
      });
    });

    byId("captionInput").addEventListener("input", function updateCaption(event) {
      byId("captionCount").textContent = String(event.target.value.length);
      saveDraft(
        event.target.value,
        drawingPad ? drawingPad.getValue() : [],
      );
    });

    byId("createForm")
      .querySelectorAll('input[name="scheduleKind"]')
      .forEach(function bindSchedule(input) {
        input.addEventListener("change", function updateTimeField() {
          var daily = byId("createForm").elements.scheduleKind.value === "daily";
          byId("createForm").querySelector(".time-field").hidden = !daily;
        });
      });
  }

  function subscribeToStore() {
    return store.subscribe(function onStoreUpdate(snapshot, detail) {
      if (detail && (detail.type === "draft-saved" || detail.type === "draft-cleared")) {
        return;
      }
      if (!snapshot.activeRoom) {
        if (!byId("roomScreen").hidden) showLanding();
        return;
      }

      var room = snapshot.rooms[snapshot.activeRoom];
      if (room) {
        currentRoom = room;
        if (!byId("roomScreen").hidden) renderRoom();
      }
    });
  }

  async function init() {
    store = global.GeurimStore;
    drawing = global.GeurimDrawing;
    if (!store || !drawing) {
      document.body.innerHTML =
        '<div class="noscript">필요한 파일을 불러오지 못했어요. index.html, store.js, drawing.js, app.js가 같은 폴더에 있는지 확인해 주세요.</div>';
      return;
    }

    await store.ready;
    renderColorOptions();
    bindEvents();
    renderHeroPreviews();
    subscribeToStore();
    var snapshot = store.getState();
    if (snapshot.activeRoom && snapshot.rooms[snapshot.activeRoom]) {
      showRoom(snapshot.rooms[snapshot.activeRoom]);
    } else {
      showLanding();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})(window);
