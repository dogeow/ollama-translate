export function LearningTab({ settings, updateSettings }) {
  return (
    <div className="card">
      <h2>学习模式</h2>
      <div className="field">
        <label className="checkbox-label" htmlFor="learningModeEnabled">
          <input
            id="learningModeEnabled"
            type="checkbox"
            checked={settings.learningModeEnabled}
            onChange={(event) =>
              updateSettings(
                { learningModeEnabled: event.target.checked },
                "now",
              )
            }
          />
          <span>启用学习模式</span>
        </label>
        <span className="hint">
          开启后，翻译完成的 tip
          弹窗会追加主句结构、句法拆分和学习说明。默认关闭，以减少额外分析带来的等待时间。
        </span>
      </div>
    </div>
  );
}
