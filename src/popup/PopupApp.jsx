export function PopupApp() {
  function openOptionsPage() {
    chrome.tabs.create({
      url: chrome.runtime.getURL("options/index.html"),
    });
    window.close();
  }

  return (
    <div className="popup">
      <h1>Ollama 翻译</h1>
      <p className="desc">选中文字后右键 →「Ollama 翻译选中内容」</p>
      <button type="button" className="btn btn-primary" onClick={openOptionsPage}>
        打开设置
      </button>
    </div>
  );
}
