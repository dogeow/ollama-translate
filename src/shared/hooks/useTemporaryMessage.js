import { useCallback, useRef, useState } from "react";

/**
 * 管理临时状态消息的通用 Hook
 * 用于显示操作反馈、通知等临时消息
 * 
 * @param {number} defaultDuration - 默认显示时长（毫秒）
 * @returns {Object} - 包含消息状态和显示函数
 */
export function useTemporaryMessage(defaultDuration = 2800) {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const timerRef = useRef(null);

  /**
   * 显示临时消息
   * @param {string} text - 要显示的消息文本
   * @param {Object} options - 配置选项
   * @param {boolean} options.isError - 是否为错误消息
   * @param {number} options.duration - 显示时长
   */
  const showMessage = useCallback(
    (text, options = {}) => {
      const {
        isError: errorFlag = false,
        duration = defaultDuration,
      } = options;

      setMessage(text);
      setIsError(errorFlag);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (duration > 0) {
        timerRef.current = window.setTimeout(() => {
          setMessage("");
          setIsError(false);
          timerRef.current = null;
        }, duration);
      }
    },
    [defaultDuration],
  );

  /**
   * 立即清除消息
   */
  const clearMessage = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage("");
    setIsError(false);
  }, []);

  /**
   * 显示成功消息
   */
  const showSuccess = useCallback(
    (text, duration) => {
      showMessage(text, { isError: false, duration });
    },
    [showMessage],
  );

  /**
   * 显示错误消息
   */
  const showError = useCallback(
    (text, duration) => {
      showMessage(text, { isError: true, duration });
    },
    [showMessage],
  );

  return {
    message,
    isError,
    showMessage,
    clearMessage,
    showSuccess,
    showError,
  };
}
