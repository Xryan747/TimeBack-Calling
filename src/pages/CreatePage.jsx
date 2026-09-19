import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadWizard from '../components/UploadWizard';
import { uploadPhoto, uploadAudio, createPersona } from '../services/api';

export default function CreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [chatLogs, setChatLogs] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function handlePhotoUpload(file) {
    setError(null);
    try {
      const result = await uploadPhoto(file);
      setPhotoFile(file);
      setPhotoUrl(result.url);
      setStep(1);
    } catch (err) {
      setError(`照片上传失败: ${err.message}`);
    }
  }

  async function handleAudioUpload(file) {
    setError(null);
    try {
      const result = await uploadAudio(file);
      setAudioFile(file);
      setAudioUrl(result.url);
    } catch (err) {
      setError(`音频上传失败: ${err.message}`);
    }
  }

  function handleSkipAudio() {
    setAudioFile(null);
    setAudioUrl(null);
    setStep(2);
  }

  async function handleCreate() {
    if (!chatLogs || chatLogs.trim().length < 10) {
      setError('请输入至少10个字的聊天记录或人物描述');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const persona = await createPersona({
        name: name || undefined,
        photoPath: photoUrl,
        audioPath: audioUrl,
        chatLogs,
      });
      navigate(`/call/${persona.id}`);
    } catch (err) {
      setError(`创建失败: ${err.message}`);
      setCreating(false);
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <h2 style={styles.title}>创建数字人</h2>
      </header>

      {error && (
        <div className="toast error" style={{ position: 'relative', top: 0, left: 0, transform: 'none', marginBottom: 12 }}>
          {error}
          <button style={styles.dismissBtn} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <UploadWizard
        step={step}
        photoFile={photoFile}
        photoUrl={photoUrl}
        audioFile={audioFile}
        audioUrl={audioUrl}
        chatLogs={chatLogs}
        name={name}
        creating={creating}
        onPhotoUpload={handlePhotoUpload}
        onAudioUpload={handleAudioUpload}
        onSkipAudio={handleSkipAudio}
        onChatLogsChange={setChatLogs}
        onNameChange={setName}
        onCreate={handleCreate}
        onStepBack={() => setStep(Math.max(0, step - 1))}
      />
    </div>
  );
}

const styles = {
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    padding: '50px 16px 20px',
    overflow: 'hidden',
    background: '#0f0f0f',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    flexShrink: 0,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#a0a0a0',
    fontSize: 15,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: '#f5f5f5',
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    marginLeft: 12,
    cursor: 'pointer',
    fontSize: 14,
    opacity: 0.7,
  },
};
