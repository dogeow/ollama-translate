/**
 * 卡片容器组件
 * 用于包装设置页面的内容区块
 */

/**
 * 基础卡片组件
 */
export function Card({
  title,
  description,
  children,
  className = "",
  ...props
}) {
  const cardClassName = `card ${className}`.trim();

  return (
    <div className={cardClassName} {...props}>
      {title && <h2>{title}</h2>}
      {description && <p className="card-description">{description}</p>}
      {children}
    </div>
  );
}

/**
 * 带标题和描述的设置卡片
 */
export function SettingCard({
  title,
  description,
  children,
  className = "",
}) {
  return (
    <Card title={title} className={`setting-card ${className}`.trim()}>
      {description && <p className="setting-description">{description}</p>}
      {children}
    </Card>
  );
}

/**
 * 信息卡片（用于提示、警告等）
 */
export function InfoCard({
  type = "info",
  title,
  children,
  className = "",
}) {
  const typeClassName = `info-card info-card--${type}`;
  const fullClassName = `${typeClassName} ${className}`.trim();

  return (
    <div className={fullClassName}>
      {title && <div className="info-card__title">{title}</div>}
      <div className="info-card__content">{children}</div>
    </div>
  );
}
