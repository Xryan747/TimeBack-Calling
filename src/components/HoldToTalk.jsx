import { useState, useCallback } from 'react';
import Icon from './Icon';

// 纯按钮:录音在通话页进页时就已常开(见 CallPage 环形缓冲),
// 这里只负责"按住/松开"手势 + 视觉反馈,按下时不再碰任何媒体管线
export default function HoldToTalk({ onPress, onRelease, disabled }) {
  const [recording, setRecording] = useState(false);

  const down = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || recording) return;
    setRecording(true);
    onPress?.();
  }, [disabled, recording, onPress]);

  const up = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (recording) {
      setRecording(false);
      onRelease?.();
    }
  }, [recording, onRelease]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    return false;
  }, []);

  return (
    <div
      style={styles.container}
      onContextMenu={handleContextMenu}
    >
      <button
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onContextMenu={handleContextMenu}
        disabled={disabled}
        style={{
          ...styles.holdBtn,
          background: recording ? '#e74c3c' : 'rgba(255,255,255,0.15)',
          transform: recording ? 'scale(0.95)' : 'scale(1)',
        }}
      >
        <Icon name="mic" size={26} color="#fff" />
        {recording && <span style={styles.recDot} />}
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    bottom: 'calc(140px + var(--safe-bottom, 0px))',
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    zIndex: 20,
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    touchAction: 'none',
  },
  holdBtn: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: '50%',
    border: '1.5px solid rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
    // 不用 backdropFilter 毛玻璃 —— 安卓 WebView 上实时模糊很吃 GPU,会拖累视频帧率
    WebkitTapHighlightColor: 'transparent',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
    touchAction: 'none',
    outline: 'none',
  },
  recDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#fff',
    animation: 'pulse 0.8s infinite',
  },
};
