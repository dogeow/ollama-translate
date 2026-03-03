import {
  IconHome,
  IconTranslate,
  IconKeyboard,
  IconBook,
  IconInfo,
  IconBrand,
} from "./NavIcons.jsx";

const NAV_ITEMS = [
  { id: "home", label: "首页", Icon: IconHome },
  { id: "translate", label: "翻译测试", Icon: IconTranslate },
  { id: "shortcuts", label: "快捷键", Icon: IconKeyboard },
  { id: "learning", label: "学习模式", Icon: IconBook },
  { id: "about", label: "关于", Icon: IconInfo },
];

export function Sidebar({ activeTab, onTabChange, currentVersion }) {
  return (
    <aside className="options-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand__icon">
          <IconBrand />
        </div>
        <span className="sidebar-brand__text">Ollama 翻译</span>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="sidebar-nav-item"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => onTabChange(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="sidebar-version">v{currentVersion}</span>
      </div>
    </aside>
  );
}
