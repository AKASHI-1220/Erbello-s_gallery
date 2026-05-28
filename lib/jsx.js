function normalizeCode(code) {
  let text = String(code || '').trim();
  const fenced = text.match(/^```(?:html|jsx|tsx|javascript|js|typescript|ts|react)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();
  return text;
}

function isJSX(code) {
  const t = normalizeCode(code);
  if (!t) return false;
  if (/^<!doctype\s+html/i.test(t) || /^<html[\s>]/i.test(t)) return false;
  if (/<script[\s>]/i.test(t) || /<body[\s>]/i.test(t)) return false;

  return (
    /from\s+['"]react['"]/i.test(t) ||
    /^\s*import\s+/m.test(t) ||
    /export\s+default\s+/i.test(t) ||
    /export\s+(const|let|var|function|class)\s+/i.test(t) ||
    /use(State|Effect|Ref|Memo|Callback|Reducer|Context|LayoutEffect)\s*\(/.test(t) ||
    /className\s*=/.test(t) ||
    /return\s*\(?\s*<([A-Za-z]|>)/m.test(t) ||
    /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\(?\s*</m.test(t)
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseNamedImports(code, sourcePattern) {
  const names = new Set();
  const re = new RegExp(`import\\s+(?:type\\s+)?(?:[^;]*?,\\s*)?\\{([^}]+)\\}\\s+from\\s+['"]${sourcePattern}['"]`, 'g');
  let match;
  while ((match = re.exec(code))) {
    match[1].split(',').forEach(part => {
      const raw = part.trim();
      if (!raw) return;
      const alias = raw.split(/\s+as\s+/i).pop().trim();
      const name = alias.replace(/[^A-Za-z0-9_$]/g, '');
      if (name) names.add(name);
    });
  }
  return [...names];
}

function parseDefaultImports(code, sourcePattern) {
  const names = new Set();
  const re = new RegExp(`import\\s+([A-Za-z_$][\\w$]*)\\s*(?:,\\s*\\{[^}]*\\})?\\s+from\\s+['"]${sourcePattern}['"]`, 'g');
  let match;
  while ((match = re.exec(code))) names.add(match[1]);
  return [...names];
}

function parseNamespaceImports(code, sourcePattern) {
  const names = new Set();
  const re = new RegExp(`import\\s+\\*\\s+as\\s+([A-Za-z_$][\\w$]*)\\s+from\\s+['"]${sourcePattern}['"]`, 'g');
  let match;
  while ((match = re.exec(code))) names.add(match[1]);
  return [...names];
}

function hasNamedImport(code, sourcePattern, name) {
  return parseNamedImports(code, sourcePattern).includes(name);
}

function stripImports(code) {
  return normalizeCode(code)
    .replace(/^\s*['"]use client['"];?\s*$/gm, '')
    .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?\s*$/gm, '')
    .replace(/^\s*export\s+\{[^}]+\};?\s*$/gm, '')
    .replace(/export\s+default\s+/g, 'var __DefaultExport = ')
    .replace(/^\s*export\s+(?=(const|let|var|function|class)\s+)/gm, '')
    .replace(/^\s*module\.exports\s*=\s*/gm, 'var __DefaultExport = ')
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function makeVarAssignments(names, factory) {
  return unique(names).map(name => `var ${name} = ${factory}(${JSON.stringify(name)});`).join('\n');
}

function wrapJSX(code, options = {}) {
  const original = normalizeCode(code);
  const title = escapeHtml(options.title || 'ERBELLO Artifact');

  const lucideNames = parseNamedImports(original, 'lucide-react');
  const lucideNamespaces = parseNamespaceImports(original, 'lucide-react');
  const rechartsNames = parseNamedImports(original, 'recharts');
  const rechartsNamespaces = parseNamespaceImports(original, 'recharts');
  const sonnerNames = parseNamedImports(original, 'sonner').filter(name => name !== 'toast');
  const uiNames = unique([
    ...parseNamedImports(original, "@\\/components\\/ui\\/[^'\"]+"),
    ...parseNamedImports(original, "\\.\\/components\\/ui\\/[^'\"]+"),
    ...parseNamedImports(original, "components\\/ui\\/[^'\"]+"),
    ...sonnerNames
  ]);
  const nextImageNames = parseDefaultImports(original, 'next/image');
  const nextLinkNames = parseDefaultImports(original, 'next/link');
  const confettiNames = parseDefaultImports(original, 'canvas-confetti');

  const wantsMotion = hasNamedImport(original, 'framer-motion', 'motion') || /from\s+['"]framer-motion['"]/.test(original);
  const wantsAnimatePresence = hasNamedImport(original, 'framer-motion', 'AnimatePresence');

  const cleaned = stripImports(original).replace(/<\/script/gi, '<\\/script');

  const iconShims = makeVarAssignments(lucideNames, 'createIconShim');
  const iconNamespaceShims = lucideNamespaces.map(name => `var ${name} = createIconNamespaceShim();`).join('\n');
  const uiShims = makeVarAssignments(uiNames, 'createUIShim');
  const rechartsShims = rechartsNames.map(name => `var ${name} = (window.Recharts && window.Recharts[${JSON.stringify(name)}]) || createRechartsShim(${JSON.stringify(name)});`).join('\n');
  const rechartsNamespaceShims = rechartsNamespaces.map(name => `var ${name} = window.Recharts || createRechartsNamespaceShim();`).join('\n');
  const motionShim = wantsMotion ? 'var motion = createMotionShim();' : '';
  const animatePresenceShim = wantsAnimatePresence ? 'var AnimatePresence = function AnimatePresence(props){ return React.createElement(React.Fragment, null, props.children); };' : '';
  const imageShim = nextImageNames.map(name => `var ${name} = createImageShim();`).join('\n');
  const linkShim = nextLinkNames.map(name => `var ${name} = createLinkShim();`).join('\n');
  const confettiShim = confettiNames.map(name => `var ${name} = function(){ return Promise.resolve(); };`).join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://unpkg.com/recharts@2.12.7/umd/Recharts.min.js"></script>
<style>
  * { box-sizing: border-box; }
  html, body, #root { min-height: 100%; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #ffffff; }
  button, input, textarea, select { font: inherit; }
  .erbello-runtime-error { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #090909; color: #f4f4f4; }
  .erbello-runtime-error > div { width: min(760px, 100%); border: 1px solid #2a2a2a; border-radius: 18px; padding: 24px; background: #111; }
  .erbello-runtime-error code { white-space: pre-wrap; color: #c7ff4f; }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="typescript,react">
const {
  useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo,
  useReducer, useContext, createContext, Fragment
} = React;

function classJoin() {
  return Array.from(arguments).flat(Infinity).filter(Boolean).join(' ');
}
var cn = classJoin;
var clsx = classJoin;
var twMerge = classJoin;
function useToast(){ return { toast: toast }; }

function createUIShim(name) {
  const tagMap = {
    Button: 'button', Input: 'input', Textarea: 'textarea', Label: 'label', Form: 'form',
    Card: 'div', CardHeader: 'div', CardContent: 'div', CardFooter: 'div', CardTitle: 'div', CardDescription: 'div',
    Badge: 'span', Separator: 'hr', Progress: 'progress', Slider: 'input', Switch: 'button', Checkbox: 'input',
    Select: 'select', SelectTrigger: 'button', SelectContent: 'div', SelectItem: 'option', SelectValue: 'span',
    Tabs: 'div', TabsList: 'div', TabsTrigger: 'button', TabsContent: 'div',
    Dialog: 'div', DialogTrigger: 'button', DialogContent: 'div', DialogHeader: 'div', DialogFooter: 'div', DialogTitle: 'div', DialogDescription: 'div',
    Sheet: 'div', SheetTrigger: 'button', SheetContent: 'div', SheetHeader: 'div', SheetFooter: 'div', SheetTitle: 'div', SheetDescription: 'div',
    Alert: 'div', AlertTitle: 'div', AlertDescription: 'div',
    Accordion: 'div', AccordionItem: 'div', AccordionTrigger: 'button', AccordionContent: 'div',
    DropdownMenu: 'div', DropdownMenuTrigger: 'button', DropdownMenuContent: 'div', DropdownMenuItem: 'button', DropdownMenuLabel: 'div', DropdownMenuSeparator: 'hr',
    RadioGroup: 'div', RadioGroupItem: 'input', ScrollArea: 'div', Avatar: 'div', AvatarImage: 'img', AvatarFallback: 'div',
    Table: 'table', TableHeader: 'thead', TableBody: 'tbody', TableFooter: 'tfoot', TableRow: 'tr', TableHead: 'th', TableCell: 'td', TableCaption: 'caption',
    Toaster: 'div'
  };
  const tag = tagMap[name] || 'div';
  return React.forwardRef(function ShimComponent(props, ref) {
    const next = { ...props, ref };
    if (name === 'Slider') next.type = next.type || 'range';
    if (name === 'Checkbox' || name === 'RadioGroupItem') next.type = name === 'Checkbox' ? 'checkbox' : 'radio';
    if (name === 'Switch') next.type = next.type || 'button';
    if (name === 'SelectItem' && next.value == null && typeof next.children === 'string') next.value = next.children;
    return React.createElement(tag, next, props.children);
  });
}

function createIconShim(name) {
  return React.forwardRef(function IconShim(props, ref) {
    const size = props.size || props.width || 24;
    const strokeWidth = props.strokeWidth || 2;
    return React.createElement('svg', {
      ...props, ref, width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
      stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
      role: 'img', 'aria-label': name
    }, React.createElement('circle', { cx: 12, cy: 12, r: 9 }), React.createElement('path', { d: 'M8 12h8M12 8v8' }));
  });
}
function createIconNamespaceShim(){ return new Proxy({}, { get: function(_, name){ return createIconShim(String(name)); } }); }

function createRechartsShim(name) {
  return function RechartsShim(props) {
    if (name === 'ResponsiveContainer') return React.createElement('div', { style: { width: '100%', height: props.height || 260 } }, props.children);
    if (/Chart$/.test(name)) return React.createElement('div', { style: { width: '100%', minHeight: 220, border: '1px dashed #bbb', borderRadius: 12, display: 'grid', placeItems: 'center', color: '#777' } }, name);
    return React.createElement(React.Fragment, null, props.children || null);
  };
}
function createRechartsNamespaceShim(){ return new Proxy({}, { get: function(_, name){ return createRechartsShim(String(name)); } }); }

function createMotionShim() {
  return new Proxy({}, {
    get: function(_, tag) {
      return React.forwardRef(function MotionShim(props, ref) {
        const clean = { ...props, ref };
        delete clean.initial; delete clean.animate; delete clean.exit; delete clean.whileHover; delete clean.whileTap;
        delete clean.transition; delete clean.variants; delete clean.layout; delete clean.viewport;
        return React.createElement(tag, clean, props.children);
      });
    }
  });
}
function createImageShim(){ return React.forwardRef(function ImageShim(props, ref){ return React.createElement('img', { ...props, ref, alt: props.alt || '' }); }); }
function createLinkShim(){ return React.forwardRef(function LinkShim(props, ref){ return React.createElement('a', { ...props, ref, href: props.href || '#' }, props.children); }); }

var toast = {
  success: function(msg){ console.log(msg); },
  error: function(msg){ console.error(msg); },
  info: function(msg){ console.log(msg); },
  warning: function(msg){ console.warn(msg); }
};

${uiShims}
${iconShims}
${iconNamespaceShims}
${rechartsShims}
${rechartsNamespaceShims}
${motionShim}
${animatePresenceShim}
${imageShim}
${linkShim}
${confettiShim}

class ErbelloErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error(error); }
  render() {
    if (this.state.error) {
      return React.createElement('div', { className: 'erbello-runtime-error' },
        React.createElement('div', null,
          React.createElement('p', { style: { color: '#c7ff4f', fontFamily: 'monospace', margin: 0 } }, 'ERBELLO RUNTIME ERROR'),
          React.createElement('h1', null, '실행 중 오류가 발생했습니다'),
          React.createElement('code', null, String(this.state.error && this.state.error.message || this.state.error))
        )
      );
    }
    return this.props.children;
  }
}

${cleaned}

(function mountArtifact() {
  const rootEl = document.getElementById('root');
  const root = ReactDOM.createRoot(rootEl);
  let target = typeof __DefaultExport !== 'undefined' ? __DefaultExport : null;
  if (!target) {
    for (const name of ['App', 'Main', 'Component', 'Page', 'Dashboard']) {
      try {
        const candidate = eval(name);
        if (typeof candidate === 'function' || React.isValidElement(candidate)) { target = candidate; break; }
      } catch (_) {}
    }
  }
  if (!target) {
    root.render(React.createElement('div', { className: 'erbello-runtime-error' },
      React.createElement('div', null,
        React.createElement('p', { style: { color: '#c7ff4f', fontFamily: 'monospace', margin: 0 } }, 'ERBELLO'),
        React.createElement('h1', null, '렌더링할 컴포넌트를 찾지 못했습니다'),
        React.createElement('p', null, 'export default App 또는 function App() 형태를 권장합니다.')
      )
    ));
    return;
  }
  const element = React.isValidElement(target) ? target : React.createElement(target);
  root.render(React.createElement(ErbelloErrorBoundary, null, element));
})();
</script>
</body>
</html>`;
}

module.exports = { isJSX, wrapJSX, normalizeCode };
