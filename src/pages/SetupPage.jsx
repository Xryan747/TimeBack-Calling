// 创建新的数字人 — 视频 / 姓名 / 语音样本 / 人设 / 基本信息 / 头像照片(可选)
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPhoto, uploadAudio, createPersona, listPersonas } from '../services/api';
import { getServerUrl } from '../services/config';
import Icon from '../components/Icon';

export default function SetupPage() {
  const navigate = useNavigate();
  const photoRef = useRef(null);
  const audioRef = useRef(null);

  const [name, setName] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [personaText, setPersonaText] = useState(''); // 人设
  const [basicInfo, setBasicInfo] = useState(''); // 基本信息
  const [avatarStatus, setAvatarStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingPersona, setExistingPersona] = useState(null);

  useEffect(() => {
    listPersonas().then(p => { if (p.length > 0) setExistingPersona(p[0]); }).catch(() => {});
  }, []);

  async function handleVideo(file) {
    setError('');
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    setVideoUploading(true);
    try {
      const form = new FormData();
      form.append('video', file);
      const res = await fetch(`${getServerUrl()}/api/upload/video`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) setVideoFile(data.data.path || file);
      else setError('视频上传失败');
    } catch (err) {
      setError(`视频上传失败: ${err.message}`);
      setVideoFile(null);
    }
    setVideoUploading(false);
  }

  async function handleAudio(file) {
    setError('');
    setAudioFile(file);
    setAudioUploading(true);
    try {
      const result = await uploadAudio(file);
      setAudioUrl(result.url);
    } catch (err) {
      setError(`音频上传失败: ${err.message}`);
      setAudioFile(null);
    }
    setAudioUploading(false);
  }

  async function handlePhoto(file) {
    setError('');
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoUploading(true);
    try {
      const result = await uploadPhoto(file);
      setPhotoUrl(result.url);
    } catch (err) {
      setError(`照片上传失败: ${err.message}`);
      setPhotoFile(null);
      setPhotoPreview(null);
    }
    setPhotoUploading(false);
  }

  async function handleSubmit() {
    if (!videoFile) {
      setError('请上传数字人视频');
      return;
    }
    const combined = [personaText, basicInfo].filter(Boolean).join('\n\n');
    if (combined.trim().length < 10) {
      setError('请填写人设或基本信息（至少10个字）');
      return;
    }

    setSubmitting(true);
    setError('');
    setAvatarStatus('');
    try {
      const persona = await createPersona({
        name: name || undefined,
        photoPath: photoUrl || undefined,
        audioPath: audioUrl || undefined,
        chatLogs: combined,
      });

      // Create LiveTalking avatar from the uploaded video
      setAvatarStatus('正在创建数字人形象...');
      const vForm = new FormData();
      vForm.append('video', videoFile);
      vForm.append('personaId', persona.id);
      vForm.append('avatarName', persona.name);
      const ltRes = await fetch(`${getServerUrl()}/api/lt-avatar`, { method: 'POST', body: vForm });
      const ltData = await ltRes.json();
      if (ltData.success) {
        setAvatarStatus(`数字人形象创建中（${ltData.data.avatarId}）...`);
      }

      navigate('/chat');
    } catch (err) {
      setError(`创建失败: ${err.message}`);
    }
    setSubmitting(false);
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/chat')}>‹</button>
        <div>
          <h2 style={styles.title}>创建数字人</h2>
          <p style={styles.subtitle}>上传资料，AI 会分析生成专属数字人</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={styles.scroll}>
        {existingPersona && (
          <div style={styles.skipBar}>
            <div>
              <span style={{ color: '#a0a0a0', fontSize: 13 }}>已有数字人：</span>
              <span style={{ color: '#f5f5f5', fontSize: 14, fontWeight: 600, marginLeft: 6 }}>{existingPersona.name}</span>
            </div>
            <button onClick={() => navigate(`/edit/${existingPersona.id}`)} style={styles.editBtn}>编辑</button>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        {/* Video */}
        <Section icon="camera" title="数字人视频" subtitle="上传一段正面说话的短视频，LiveTalking 将自动生成数字人形象">
          <div
            className={`file-input-area ${videoPreview ? 'has-file' : ''}`}
            style={styles.uploadArea}
            onClick={() => photoRef.current?.click()}
          >
            {videoUploading ? (
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 8px' }} />
                <p style={{ color: '#666', fontSize: 13 }}>上传中...</p>
              </div>
            ) : videoPreview ? (
              <div style={{ textAlign: 'center' }}>
                <video src={videoPreview} style={styles.preview} muted />
                <p style={styles.previewHint}>点击重新选择</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Icon name="camera" size={36} color="#555" style={{ marginBottom: 8 }} />
                <p style={{ color: '#f5f5f5', fontSize: 14 }}>点击上传说话视频</p>
                <p style={{ color: '#555', fontSize: 12, marginTop: 4 }}>MP4/MOV，正面说话 10-60 秒效果最佳</p>
              </div>
            )}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files[0]; if (f) handleVideo(f); }}
          />
          <div style={styles.note}>
            注意：正面视频、10s 左右，不要有大幅度的偏移和动作
          </div>
          {avatarStatus && <p style={{ color: '#07C160', fontSize: 12, marginTop: 8, textAlign: 'center' }}>{avatarStatus}</p>}
        </Section>

        {/* Name */}
        <Section icon="user" title="姓名">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="给数字人取个名字（选填，AI会自动取名）"
            style={styles.textInput}
          />
        </Section>

        {/* Audio */}
        <Section icon="mic" title="语音样本" subtitle="上传一段说话音频，用于声音克隆（可选）">
          <div
            className={`file-input-area ${audioUrl ? 'has-file' : ''}`}
            style={{ ...styles.uploadArea, minHeight: audioUrl ? 'auto' : 100, padding: audioUrl ? 16 : 30 }}
            onClick={() => audioRef.current?.click()}
          >
            {audioUploading ? (
              <div style={{ textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto 8px' }} />
                <p style={{ color: '#666', fontSize: 13 }}>上传中...</p>
              </div>
            ) : audioUrl ? (
              <div style={{ textAlign: 'center' }}>
                <Icon name="mic" size={24} color="#f5f5f5" style={{ marginBottom: 4 }} />
                <p style={{ color: '#f5f5f5', fontSize: 13 }}>{audioFile?.name || '已上传'}</p>
                <p style={styles.previewHint}>点击重新选择</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Icon name="mic" size={24} color="#555" style={{ marginBottom: 4 }} />
                <p style={{ color: '#888', fontSize: 13 }}>MP3/WAV，10-30秒人声最佳</p>
              </div>
            )}
          </div>
          <input
            ref={audioRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files[0]; if (f) handleAudio(f); }}
          />
        </Section>

        {/* 人设 */}
        <Section icon="doc" title="人设" subtitle="描述这个人的性格、口头禅、说话方式等">
          <textarea
            value={personaText}
            onChange={(e) => setPersonaText(e.target.value)}
            placeholder={`例如：\n- 性格温和慈祥，说话慢条斯理\n- 喜欢叫对方"乖乖"或"宝贝"\n- 总是担心别人吃不好穿不暖\n- 退休小学教师，喜欢包饺子和种花\n- 说话带轻微方言口音`}
            style={{ ...styles.textInput, minHeight: 120, resize: 'vertical' }}
          />
          <p style={styles.charCount}>{personaText.length} 字</p>
        </Section>

        {/* 基本信息 */}
        <Section icon="info" title="基本信息" subtitle="年龄、职业、居住地、家庭成员等">
          <textarea
            value={basicInfo}
            onChange={(e) => setBasicInfo(e.target.value)}
            placeholder={`例如：\n- 姓名：孟凡琴，68岁\n- 家住黑龙江宝清县\n- 有一个儿子，小名叫"宏生"\n- 年轻时是小学语文老师`}
            style={{ ...styles.textInput, minHeight: 100, resize: 'vertical' }}
          />
          <p style={styles.charCount}>{basicInfo.length} 字</p>
        </Section>

        {/* Photo */}
        <Section icon="image" title="头像照片（可选）" subtitle="聊天列表中显示的头像">
          <div
            className={`file-input-area ${photoPreview ? 'has-file' : ''}`}
            style={{ ...styles.uploadArea, minHeight: 80, padding: 16 }}
            onClick={() => document.getElementById('photo-input')?.click()}
          >
            {photoUploading ? (
              <div className="spinner" style={{ margin: '0 auto' }} />
            ) : photoPreview ? (
              <div style={{ textAlign: 'center' }}>
                <img src={photoPreview} alt="预览" style={{ maxHeight: 120, borderRadius: 8 }} />
                <p style={styles.previewHint}>点击更换照片</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <Icon name="image" size={24} color="#555" style={{ marginBottom: 4 }} />
                <p style={{ color: '#555', fontSize: 13 }}>点击上传照片（可选）</p>
              </div>
            )}
          </div>
          <input
            id="photo-input"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files[0]; if (f) handlePhoto(f); }}
          />
        </Section>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || !videoFile}
          style={{
            ...styles.submitBtn,
            opacity: submitting || !videoFile ? 0.5 : 1,
          }}
        >
          {submitting ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              AI 分析中...
            </span>
          ) : (
            '生成数字人'
          )}
        </button>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

function Section({ icon, title, subtitle, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <Icon name={icon} size={18} color="#f5f5f5" />
        <div>
          <h3 style={styles.sectionTitle}>{title}</h3>
          {subtitle && <p style={styles.sectionSubtitle}>{subtitle}</p>}
        </div>
      </div>
      <div style={styles.sectionContent}>{children}</div>
    </div>
  );
}

const styles = {
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#0f0f0f',
  },
  header: {
    padding: 'calc(var(--status-bar-h) + 8px) 16px 10px',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    flexShrink: 0,
  },
  backBtn: {
    background: 'none', border: 'none', color: '#a0a0a0', fontSize: 30,
    cursor: 'pointer', lineHeight: 1, padding: '0 4px', marginTop: -2,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f5f5f5',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 16px 20px',
    WebkitOverflowScrolling: 'touch',
  },
  skipBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(7,193,96,0.1)',
    border: '1px solid rgba(7,193,96,0.2)',
    borderRadius: 12,
    padding: '12px 14px',
    marginBottom: 16,
  },
  editBtn: {
    background: 'rgba(255,255,255,0.1)',
    color: '#f5f5f5',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '8px 16px',
    borderRadius: 18,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  error: {
    background: 'rgba(231,76,60,0.12)',
    color: '#e74c3c',
    padding: '10px 14px',
    borderRadius: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  note: {
    marginTop: 10,
    background: 'rgba(255,193,7,0.08)',
    borderLeft: '3px solid #d9b84a',
    color: '#d9b84a',
    fontSize: 12,
    lineHeight: 1.6,
    padding: '8px 10px',
    borderRadius: 6,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#f5f5f5',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionContent: {
    background: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    border: '1px solid #2a2a2a',
  },
  textInput: {
    width: '100%',
    background: '#111',
    border: '1px solid #333',
    borderRadius: 10,
    color: '#f5f5f5',
    fontSize: 14,
    padding: '12px 14px',
    fontFamily: 'inherit',
    outline: 'none',
    lineHeight: 1.6,
    boxSizing: 'border-box',
  },
  uploadArea: {
    padding: '30px 20px',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  preview: {
    maxWidth: '100%',
    maxHeight: 180,
    borderRadius: 8,
    objectFit: 'contain',
  },
  previewHint: {
    fontSize: 11,
    color: '#555',
    marginTop: 6,
  },
  charCount: {
    fontSize: 11,
    color: '#555',
    textAlign: 'right',
    marginTop: 6,
  },
  submitBtn: {
    width: '100%',
    padding: '16px 0',
    background: '#07C160',
    color: '#fff',
    border: 'none',
    borderRadius: 26,
    fontSize: 17,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    transition: 'opacity 0.2s',
  },
};
