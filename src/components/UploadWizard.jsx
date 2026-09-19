import { useRef, useState } from 'react';

const STEPS = [
  { label: '照片', desc: '上传数字人的照片' },
  { label: '声音', desc: '上传语音样本（可选）' },
  { label: '习惯', desc: '输入聊天记录或说话习惯' },
];

export default function UploadWizard({
  step,
  photoFile,
  photoUrl,
  audioFile,
  audioUrl,
  chatLogs,
  name,
  creating,
  onPhotoUpload,
  onAudioUpload,
  onSkipAudio,
  onChatLogsChange,
  onNameChange,
  onCreate,
  onStepBack,
}) {
  const photoInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div style={styles.wrapper}>
      {/* Step indicators */}
      <div style={styles.steps}>
        {STEPS.map((s, i) => (
          <div key={s.label} style={styles.stepRow}>
            <div
              style={{
                ...styles.stepDot,
                background: i < step ? '#07C160' : i === step ? '#07C160' : '#333',
                borderColor: i <= step ? '#07C160' : '#333',
                color: i < step ? '#fff' : i === step ? '#fff' : '#666',
              }}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <div style={styles.stepInfo}>
              <span style={{ ...styles.stepLabel, color: i <= step ? '#f5f5f5' : '#555' }}>
                {s.label}
              </span>
              <span style={styles.stepDesc}>{s.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={styles.content}>
        {step === 0 && (
          <div style={styles.stepContent}>
            <h3 style={styles.stepTitle}>上传照片</h3>
            <p style={styles.stepHint}>这张照片将作为数字人的面部形象</p>

            <div
              className={`file-input-area ${dragOver ? 'active' : ''} ${photoUrl ? 'has-file' : ''}`}
              style={styles.dropZone}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                  onPhotoUpload(file);
                }
              }}
              onClick={() => photoInputRef.current?.click()}
            >
              {photoUrl ? (
                <div>
                  <img src={photoUrl} alt="预览" style={styles.preview} />
                  <p style={styles.previewHint}>点击重新选择</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 48, marginBottom: 12 }}>📷</p>
                  <p style={styles.dropText}>点击或拖拽照片到此处</p>
                  <p style={styles.dropHint}>支持 JPG、PNG、WebP</p>
                </div>
              )}
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) onPhotoUpload(file);
              }}
            />
          </div>
        )}

        {step === 1 && (
          <div style={styles.stepContent}>
            <h3 style={styles.stepTitle}>上传语音样本</h3>
            <p style={styles.stepHint}>用于 V2 语音克隆。现在可跳过，通话时使用预设声音</p>

            <div
              className={`file-input-area ${audioUrl ? 'has-file' : ''}`}
              style={styles.dropZone}
              onClick={() => audioInputRef.current?.click()}
            >
              {audioUrl ? (
                <div>
                  <p style={{ fontSize: 36, marginBottom: 8 }}>🎵</p>
                  <p style={styles.dropText}>{audioFile?.name || '已上传'}</p>
                  <p style={styles.previewHint}>点击重新选择</p>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 48, marginBottom: 12 }}>🎤</p>
                  <p style={styles.dropText}>点击上传音频文件</p>
                  <p style={styles.dropHint}>支持 MP3、WAV、M4A（最长5分钟）</p>
                </div>
              )}
            </div>

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) onAudioUpload(file);
              }}
            />

            <div style={styles.stepActions}>
              <button className="btn btn-ghost" onClick={onSkipAudio}>跳过</button>
              {audioUrl && (
                <button className="btn btn-primary" onClick={() => {}} style={{ marginLeft: 12 }}>
                  下一步 →
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={styles.stepContent}>
            <h3 style={styles.stepTitle}>输入对话风格</h3>
            <p style={styles.stepHint}>粘贴这个人的聊天记录、说话习惯或性格描述。AI 会分析并生成模仿其风格的回复</p>

            <input
              type="text"
              placeholder="数字人名称（选填，AI会自动取名）"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            <textarea
              placeholder={`例如：
我和外婆的微信聊天记录：
外婆：乖乖，今天吃了没？
我：吃了，外婆你呢？
外婆：我也吃了。天冷了多穿点衣服。
我：好的外婆，你也要注意保暖。

或者描述人物习惯：
外婆今年78岁，性格温和慈祥，喜欢叫孙辈"乖乖"。说话带有轻微方言，喜欢回忆往事，总是担心孙辈穿得够不够暖、吃得好不好...`}
              value={chatLogs}
              onChange={(e) => onChatLogsChange(e.target.value)}
              style={{ minHeight: 200, lineHeight: 1.8 }}
              disabled={creating}
            />
            <p style={styles.charCount}>
              {chatLogs.length} 字 {chatLogs.length < 10 ? '(至少10个字)' : '✓'}
            </p>

            <div style={styles.stepActions}>
              {creating ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', width: '100%' }}>
                  <div className="spinner" style={{ width: 28, height: 28 }} />
                  <span style={{ color: '#a0a0a0', fontSize: 15 }}>AI 正在分析对话风格...</span>
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={onCreate}
                  disabled={!chatLogs || chatLogs.trim().length < 10}
                  style={{ width: '100%', padding: '14px 0', fontSize: 17 }}
                >
                  生成数字人
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    paddingBottom: 24,
    flexShrink: 0,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 600,
    border: '2px solid',
    flexShrink: 0,
  },
  stepInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: 600,
  },
  stepDesc: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 20,
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#f5f5f5',
  },
  stepHint: {
    fontSize: 13,
    color: '#a0a0a0',
    lineHeight: 1.5,
    marginBottom: 8,
  },
  dropZone: {
    padding: '40px 20px',
    minHeight: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropText: {
    fontSize: 16,
    color: '#f5f5f5',
    fontWeight: 500,
  },
  dropHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  preview: {
    maxWidth: '100%',
    maxHeight: 200,
    borderRadius: 8,
    objectFit: 'contain',
  },
  previewHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  stepActions: {
    display: 'flex',
    justifyContent: 'center',
    paddingTop: 16,
  },
};
