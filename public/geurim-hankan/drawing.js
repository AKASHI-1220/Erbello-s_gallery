(function exposeGeurimDrawing(global) {
  "use strict";

  var COLORS = [
    { value: "#292724", labelKey: "drawing.colorInk", label: "먹색" },
    { value: "#ef6a5b", labelKey: "drawing.colorCoral", label: "다홍색" },
    { value: "#f2b84b", labelKey: "drawing.colorYellow", label: "노란색" },
    { value: "#5a9f68", labelKey: "drawing.colorGreen", label: "초록색" },
    { value: "#4c7fc0", labelKey: "drawing.colorBlue", label: "파란색" },
    { value: "#8c67ad", labelKey: "drawing.colorPurple", label: "보라색" },
  ];

  var WIDTHS = [
    { value: 4, labelKey: "drawing.widthThin", label: "얇게" },
    { value: 8, labelKey: "drawing.widthMedium", label: "보통" },
    { value: 14, labelKey: "drawing.widthThick", label: "굵게" },
  ];

  var BASE_CANVAS_SIZE = 520;
  var mountSequence = 0;
  var mountedPads = new WeakMap();
  var previewRecords = new WeakMap();

  function tr(key, replacements, fallback) {
    var i18n = global.GeurimI18n;
    return i18n && typeof i18n.t === "function"
      ? i18n.t(key, replacements, fallback)
      : fallback || key;
  }

  var requestFrame =
    typeof global.requestAnimationFrame === "function"
      ? global.requestAnimationFrame.bind(global)
      : function requestFrameFallback(callback) {
          return global.setTimeout(callback, 16);
        };

  var cancelFrame =
    typeof global.cancelAnimationFrame === "function"
      ? global.cancelAnimationFrame.bind(global)
      : global.clearTimeout.bind(global);

  function clampUnit(value) {
    return Math.min(1, Math.max(0, value));
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function makeStrokeId() {
    if (
      global.crypto &&
      typeof global.crypto.randomUUID === "function"
    ) {
      return global.crypto.randomUUID();
    }

    return (
      "stroke-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 9)
    );
  }

  function sanitizeStroke(stroke) {
    if (!stroke || typeof stroke !== "object") return null;

    var points = Array.isArray(stroke.points)
      ? stroke.points
          .filter(function validPoint(point) {
            return (
              point &&
              isFiniteNumber(point.x) &&
              isFiniteNumber(point.y)
            );
          })
          .map(function copyPoint(point) {
            return {
              x: clampUnit(point.x),
              y: clampUnit(point.y),
            };
          })
      : [];

    if (points.length === 0) return null;

    return {
      id:
        typeof stroke.id === "string" && stroke.id
          ? stroke.id
          : makeStrokeId(),
      color:
        typeof stroke.color === "string" && stroke.color
          ? stroke.color
          : COLORS[0].value,
      width:
        isFiniteNumber(stroke.width) && stroke.width > 0
          ? Math.min(stroke.width, 64)
          : WIDTHS[1].value,
      points: points,
    };
  }

  function normalizeStrokes(value) {
    if (!Array.isArray(value)) return [];

    return value
      .map(sanitizeStroke)
      .filter(function removeInvalidStroke(stroke) {
        return stroke !== null;
      });
  }

  function cloneStrokes(strokes) {
    return strokes.map(function cloneStroke(stroke) {
      return {
        id: stroke.id,
        color: stroke.color,
        width: stroke.width,
        points: stroke.points.map(function clonePoint(point) {
          return { x: point.x, y: point.y };
        }),
      };
    });
  }

  function setCanvasDisplayDefaults(canvas) {
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.aspectRatio = "1 / 1";
  }

  function prepareCanvas(canvas, forceSquare) {
    var bounds = canvas.getBoundingClientRect();
    var width = Math.max(
      1,
      bounds.width || canvas.clientWidth || canvas.width || 300,
    );
    var height = forceSquare
      ? width
      : Math.max(
          1,
          bounds.height || canvas.clientHeight || canvas.height || width,
        );
    var pixelRatio = Math.min(global.devicePixelRatio || 1, 3);
    var targetWidth = Math.max(1, Math.round(width * pixelRatio));
    var targetHeight = Math.max(1, Math.round(height * pixelRatio));

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    var context = canvas.getContext("2d");
    if (!context) return null;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    return {
      context: context,
      width: width,
      height: height,
    };
  }

  function drawStrokes(canvas, strokes, forceSquare) {
    var surface = prepareCanvas(canvas, forceSquare);
    if (!surface) return;

    var context = surface.context;
    var width = surface.width;
    var height = surface.height;
    var widthScale = Math.min(width, height) / BASE_CANVAS_SIZE;

    context.lineCap = "round";
    context.lineJoin = "round";

    strokes.forEach(function drawStroke(stroke) {
      var points = stroke.points.filter(function validPoint(point) {
        return (
          point &&
          isFiniteNumber(point.x) &&
          isFiniteNumber(point.y)
        );
      });

      if (points.length === 0) return;

      var lineWidth = Math.max(1.25, stroke.width * widthScale);
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.lineWidth = lineWidth;

      if (points.length === 1) {
        context.beginPath();
        context.arc(
          clampUnit(points[0].x) * width,
          clampUnit(points[0].y) * height,
          lineWidth / 2,
          0,
          Math.PI * 2,
        );
        context.fill();
        return;
      }

      context.beginPath();
      context.moveTo(
        clampUnit(points[0].x) * width,
        clampUnit(points[0].y) * height,
      );

      for (var index = 1; index < points.length - 1; index += 1) {
        var point = points[index];
        var nextPoint = points[index + 1];
        var midpointX =
          clampUnit((point.x + nextPoint.x) / 2) * width;
        var midpointY =
          clampUnit((point.y + nextPoint.y) / 2) * height;

        context.quadraticCurveTo(
          clampUnit(point.x) * width,
          clampUnit(point.y) * height,
          midpointX,
          midpointY,
        );
      }

      var lastPoint = points[points.length - 1];
      context.lineTo(
        clampUnit(lastPoint.x) * width,
        clampUnit(lastPoint.y) * height,
      );
      context.stroke();
    });
  }

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) element.className = className;
    if (typeof text === "string") element.textContent = text;
    return element;
  }

  function resolveContainer(container) {
    var resolved =
      typeof container === "string"
        ? document.querySelector(container)
        : container;

    if (!resolved || resolved.nodeType !== 1) {
      throw new TypeError(
        "GeurimDrawing.mountPad: container 요소를 찾을 수 없습니다.",
      );
    }

    return resolved;
  }

  function mountPad(container, options) {
    var host = resolveContainer(container);
    var previousPad = mountedPads.get(host);
    if (previousPad) previousPad.destroy();

    var settings = options || {};
    var onChange =
      typeof settings.onChange === "function"
        ? settings.onChange
        : function noop() {};
    var strokes = normalizeStrokes(settings.value);
    var draft = null;
    var activePointerId = null;
    var selectedColor = COLORS[0].value;
    var selectedWidth = WIDTHS[1].value;
    var destroyed = false;
    var frame = 0;
    var cleanupListeners = [];
    var lastTouchAt = 0;
    var instanceId = "geurim-drawing-" + (++mountSequence);

    var root = createElement("section", "drawing-canvas");
    root.setAttribute(
      "aria-label",
      tr("drawing.toolAria", null, "그림 그리기 도구"),
    );

    var toolbar = createElement("div", "drawing-canvas__toolbar");
    var colorGroup = createElement("div", "drawing-canvas__group");
    var colorLabel = createElement(
      "span",
      "drawing-canvas__label",
      tr("drawing.color", null, "색"),
    );
    colorLabel.id = instanceId + "-color-label";
    var palette = createElement("div", "drawing-canvas__palette");
    palette.setAttribute("role", "group");
    palette.setAttribute("aria-labelledby", colorLabel.id);

    var colorButtons = COLORS.map(function createColorButton(option) {
      var button = createElement(
        "button",
        "drawing-canvas__color",
      );
      button.type = "button";
      var optionLabel = tr(option.labelKey, null, option.label);
      button.title = optionLabel;
      button.style.backgroundColor = option.value;
      button.setAttribute("aria-label", optionLabel);
      button.setAttribute(
        "aria-pressed",
        String(selectedColor === option.value),
      );
      button.addEventListener("click", function selectColor() {
        selectedColor = option.value;
        updateControls();
      });
      palette.appendChild(button);
      return { element: button, value: option.value };
    });

    colorGroup.append(colorLabel, palette);

    var widthGroup = createElement("div", "drawing-canvas__group");
    var widthLabel = createElement(
      "span",
      "drawing-canvas__label",
      tr("drawing.width", null, "굵기"),
    );
    widthLabel.id = instanceId + "-width-label";
    var widths = createElement("div", "drawing-canvas__widths");
    widths.setAttribute("role", "group");
    widths.setAttribute("aria-labelledby", widthLabel.id);

    var widthButtons = WIDTHS.map(function createWidthButton(option) {
      var button = createElement(
        "button",
        "drawing-canvas__width",
      );
      var sample = createElement(
        "span",
        "drawing-canvas__width-sample",
      );

      button.type = "button";
      var optionLabel = tr(option.labelKey, null, option.label);
      button.title = optionLabel;
      button.setAttribute("aria-label", optionLabel);
      button.setAttribute(
        "aria-pressed",
        String(selectedWidth === option.value),
      );
      sample.style.height = Math.max(2, option.value / 2) + "px";
      sample.setAttribute("aria-hidden", "true");
      button.appendChild(sample);
      button.addEventListener("click", function selectWidth() {
        selectedWidth = option.value;
        updateControls();
      });
      widths.appendChild(button);
      return { element: button, value: option.value };
    });

    widthGroup.append(widthLabel, widths);

    var actions = createElement("div", "drawing-canvas__actions");
    var undoButton = createElement(
      "button",
      "drawing-canvas__action",
      tr("drawing.undo", null, "실행 취소"),
    );
    undoButton.type = "button";
    undoButton.setAttribute(
      "aria-label",
      tr("drawing.undoAria", null, "마지막 획 실행 취소"),
    );

    var clearButton = createElement(
      "button",
      "drawing-canvas__action drawing-canvas__action--clear",
      tr("drawing.clear", null, "전체 지우기"),
    );
    clearButton.type = "button";
    clearButton.setAttribute(
      "aria-label",
      tr("drawing.clearAria", null, "그림 전체 지우기"),
    );
    actions.append(undoButton, clearButton);
    toolbar.append(colorGroup, widthGroup, actions);

    var stage = createElement("div", "drawing-canvas__stage");
    var canvas = createElement("canvas", "drawing-canvas__surface");
    canvas.textContent = tr(
      "drawing.canvasFallback",
      null,
      "이 브라우저에서는 그림 그리기 캔버스를 표시할 수 없습니다.",
    );
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute(
      "aria-label",
      tr("drawing.canvasAria", null, "그림을 그리는 정사각형 캔버스"),
    );
    canvas.setAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    setCanvasDisplayDefaults(canvas);

    var hint = createElement(
      "p",
      "drawing-canvas__hint",
      tr(
        "drawing.hint",
        null,
        "마우스, 펜 또는 손가락으로 그려 보세요. Ctrl 또는 ⌘와 Z를 누르면 마지막 획을 되돌릴 수 있어요.",
      ),
    );
    hint.id = instanceId + "-help";

    var status = createElement("span", "drawing-canvas__status");
    status.id = instanceId + "-status";
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    stage.append(canvas, hint, status);
    root.append(toolbar, stage);
    host.replaceChildren(root);

    function listen(target, type, handler, listenerOptions) {
      target.addEventListener(type, handler, listenerOptions);
      cleanupListeners.push(function removeListener() {
        target.removeEventListener(type, handler, listenerOptions);
      });
    }

    function schedulePaint() {
      cancelFrame(frame);
      frame = requestFrame(function paintFrame() {
        frame = 0;
        if (!destroyed) {
          drawStrokes(
            canvas,
            draft ? strokes.concat([draft]) : strokes,
            true,
          );
        }
      });
    }

    function updateControls() {
      colorButtons.forEach(function updateColorButton(item) {
        var selected = item.value === selectedColor;
        item.element.classList.toggle("is-selected", selected);
        item.element.setAttribute("aria-pressed", String(selected));
      });

      widthButtons.forEach(function updateWidthButton(item) {
        var selected = item.value === selectedWidth;
        item.element.classList.toggle("is-selected", selected);
        item.element.setAttribute("aria-pressed", String(selected));
      });

      var isEmpty = strokes.length === 0;
      undoButton.disabled = isEmpty;
      clearButton.disabled = isEmpty;
      hint.hidden = !isEmpty || draft !== null;
      status.textContent = tr(
        "drawing.strokeCount",
        { count: strokes.length },
        "현재 " + strokes.length + "개의 획",
      );
      canvas.setAttribute(
        "aria-describedby",
        hint.hidden ? status.id : hint.id + " " + status.id,
      );
    }

    function emitChange() {
      onChange(cloneStrokes(strokes));
    }

    function pointFromClient(clientX, clientY) {
      var bounds = canvas.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return null;

      return {
        x: clampUnit((clientX - bounds.left) / bounds.width),
        y: clampUnit((clientY - bounds.top) / bounds.height),
      };
    }

    function beginStroke(clientX, clientY, pointerId) {
      if (destroyed || activePointerId !== null) return false;
      var point = pointFromClient(clientX, clientY);
      if (!point) return false;

      activePointerId = pointerId;
      draft = {
        id: makeStrokeId(),
        color: selectedColor,
        width: selectedWidth,
        points: [point],
      };

      canvas.focus({ preventScroll: true });
      updateControls();
      schedulePaint();
      return true;
    }

    function appendClientPoint(clientX, clientY) {
      if (!draft) return;
      var point = pointFromClient(clientX, clientY);
      if (!point) return;

      var previousPoint = draft.points[draft.points.length - 1];
      var distance = Math.hypot(
        point.x - previousPoint.x,
        point.y - previousPoint.y,
      );

      if (distance < 0.00075) return;
      draft.points.push(point);
    }

    function releasePointerCapture(pointerId) {
      if (
        typeof pointerId !== "number" ||
        typeof canvas.hasPointerCapture !== "function" ||
        !canvas.hasPointerCapture(pointerId)
      ) {
        return;
      }

      try {
        canvas.releasePointerCapture(pointerId);
      } catch (_error) {
        // The browser may already have released capture during cancellation.
      }
    }

    function finishStroke(pointerId, shouldCommit) {
      if (activePointerId !== pointerId) return;

      var completedStroke = draft;
      activePointerId = null;
      draft = null;
      releasePointerCapture(pointerId);

      if (
        shouldCommit &&
        completedStroke &&
        completedStroke.points.length > 0
      ) {
        strokes.push(completedStroke);
      }

      updateControls();
      schedulePaint();
      if (shouldCommit && completedStroke) emitChange();
    }

    function cancelActiveStroke() {
      if (activePointerId === null) return;
      var pointerId = activePointerId;
      activePointerId = null;
      draft = null;
      releasePointerCapture(pointerId);
      updateControls();
      schedulePaint();
    }

    function undo() {
      if (destroyed || strokes.length === 0) return;
      strokes.pop();
      updateControls();
      schedulePaint();
      emitChange();
    }

    function clear() {
      if (destroyed) return;
      cancelActiveStroke();
      if (strokes.length === 0) return;
      strokes = [];
      updateControls();
      schedulePaint();
      emitChange();
    }

    listen(undoButton, "click", undo);
    listen(clearButton, "click", clear);

    if ("PointerEvent" in global) {
      listen(canvas, "pointerdown", function onPointerDown(event) {
        if (
          event.isPrimary === false ||
          (event.pointerType === "mouse" && event.button !== 0)
        ) {
          return;
        }

        if (
          beginStroke(
            event.clientX,
            event.clientY,
            event.pointerId,
          )
        ) {
          event.preventDefault();
          try {
            canvas.setPointerCapture(event.pointerId);
          } catch (_error) {
            // Drawing still works while the pointer remains over the canvas.
          }
        }
      });

      listen(
        canvas,
        "pointermove",
        function onPointerMove(event) {
          if (activePointerId !== event.pointerId) return;
          event.preventDefault();

          var events =
            typeof event.getCoalescedEvents === "function"
              ? event.getCoalescedEvents()
              : [event];

          events.forEach(function appendCoalescedPoint(pointerEvent) {
            appendClientPoint(
              pointerEvent.clientX,
              pointerEvent.clientY,
            );
          });
          schedulePaint();
        },
        { passive: false },
      );

      listen(canvas, "pointerup", function onPointerUp(event) {
        if (activePointerId !== event.pointerId) return;
        event.preventDefault();
        appendClientPoint(event.clientX, event.clientY);
        finishStroke(event.pointerId, true);
      });

      listen(canvas, "pointercancel", function onPointerCancel(event) {
        finishStroke(event.pointerId, false);
      });

      listen(
        canvas,
        "lostpointercapture",
        function onLostPointerCapture(event) {
          finishStroke(event.pointerId, true);
        },
      );
    } else {
      listen(canvas, "mousedown", function onMouseDown(event) {
        if (event.button !== 0 || Date.now() - lastTouchAt < 750) return;
        if (beginStroke(event.clientX, event.clientY, "mouse")) {
          event.preventDefault();
        }
      });

      listen(global, "mousemove", function onMouseMove(event) {
        if (activePointerId !== "mouse") return;
        event.preventDefault();
        appendClientPoint(event.clientX, event.clientY);
        schedulePaint();
      });

      listen(global, "mouseup", function onMouseUp(event) {
        if (activePointerId !== "mouse") return;
        appendClientPoint(event.clientX, event.clientY);
        finishStroke("mouse", true);
      });

      listen(
        canvas,
        "touchstart",
        function onTouchStart(event) {
          if (activePointerId !== null || !event.changedTouches.length) {
            return;
          }

          var touch = event.changedTouches[0];
          var pointerId = "touch:" + touch.identifier;
          if (
            beginStroke(
              touch.clientX,
              touch.clientY,
              pointerId,
            )
          ) {
            lastTouchAt = Date.now();
            event.preventDefault();
          }
        },
        { passive: false },
      );

      listen(
        canvas,
        "touchmove",
        function onTouchMove(event) {
          if (
            typeof activePointerId !== "string" ||
            activePointerId.indexOf("touch:") !== 0
          ) {
            return;
          }

          var identifier = Number(activePointerId.slice(6));
          for (var index = 0; index < event.touches.length; index += 1) {
            var touch = event.touches.item(index);
            if (touch && touch.identifier === identifier) {
              event.preventDefault();
              appendClientPoint(touch.clientX, touch.clientY);
              schedulePaint();
              return;
            }
          }
        },
        { passive: false },
      );

      function finishTouch(event, shouldCommit) {
        if (
          typeof activePointerId !== "string" ||
          activePointerId.indexOf("touch:") !== 0
        ) {
          return;
        }

        var identifier = Number(activePointerId.slice(6));
        for (
          var index = 0;
          index < event.changedTouches.length;
          index += 1
        ) {
          var touch = event.changedTouches.item(index);
          if (touch && touch.identifier === identifier) {
            event.preventDefault();
            appendClientPoint(touch.clientX, touch.clientY);
            finishStroke(activePointerId, shouldCommit);
            lastTouchAt = Date.now();
            return;
          }
        }
      }

      listen(
        canvas,
        "touchend",
        function onTouchEnd(event) {
          finishTouch(event, true);
        },
        { passive: false },
      );

      listen(
        canvas,
        "touchcancel",
        function onTouchCancel(event) {
          finishTouch(event, false);
        },
        { passive: false },
      );
    }

    listen(canvas, "keydown", function onCanvasKeyDown(event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        String(event.key).toLowerCase() === "z"
      ) {
        event.preventDefault();
        undo();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelActiveStroke();
      }
    });

    listen(global, "blur", cancelActiveStroke);

    var resizeObserver =
      typeof global.ResizeObserver === "function"
        ? new global.ResizeObserver(schedulePaint)
        : null;
    resizeObserver?.observe(canvas);
    listen(global, "resize", schedulePaint);

    function getValue() {
      return cloneStrokes(strokes);
    }

    function setValue(nextValue) {
      if (destroyed) return;
      cancelActiveStroke();
      strokes = normalizeStrokes(nextValue);
      updateControls();
      schedulePaint();
    }

    var controller = {
      getValue: getValue,
      setValue: setValue,
      clear: clear,
      destroy: function destroy() {
        if (destroyed) return;
        destroyed = true;
        cancelFrame(frame);
        resizeObserver?.disconnect();
        cleanupListeners.forEach(function runCleanup(removeListener) {
          removeListener();
        });
        cleanupListeners = [];
        root.remove();

        if (mountedPads.get(host) === controller) {
          mountedPads.delete(host);
        }
      },
    };

    mountedPads.set(host, controller);
    updateControls();
    schedulePaint();
    return controller;
  }

  function renderPreview(canvas, value) {
    if (!canvas || canvas.nodeName !== "CANVAS") {
      throw new TypeError(
        "GeurimDrawing.renderPreview: canvas 요소가 필요합니다.",
      );
    }

    setCanvasDisplayDefaults(canvas);
    var record = previewRecords.get(canvas);

    if (!record) {
      record = {
        strokes: [],
        frame: 0,
        destroyed: false,
        observer: null,
        schedule: null,
        destroy: null,
      };

      record.schedule = function schedulePreviewPaint() {
        cancelFrame(record.frame);
        record.frame = requestFrame(function paintPreviewFrame() {
          record.frame = 0;
          if (!record.destroyed) {
            drawStrokes(canvas, record.strokes, true);
          }
        });
      };

      var onResize = record.schedule;
      record.observer =
        typeof global.ResizeObserver === "function"
          ? new global.ResizeObserver(record.schedule)
          : null;
      record.observer?.observe(canvas);
      global.addEventListener("resize", onResize);

      record.destroy = function destroyPreview() {
        if (record.destroyed) return;
        record.destroyed = true;
        cancelFrame(record.frame);
        record.observer?.disconnect();
        global.removeEventListener("resize", onResize);
        if (previewRecords.get(canvas) === record) {
          previewRecords.delete(canvas);
        }
      };

      previewRecords.set(canvas, record);
    }

    record.strokes = normalizeStrokes(value);
    drawStrokes(canvas, record.strokes, true);
    return record.destroy;
  }

  global.GeurimDrawing = Object.freeze({
    mountPad: mountPad,
    renderPreview: renderPreview,
  });
})(window);
