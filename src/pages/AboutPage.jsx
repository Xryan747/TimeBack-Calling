// 关于 — app 信息与免责声明(客户随时可查,不依赖纸质文档)
import { useNavigate } from 'react-router-dom';
import { W } from './wechatTheme';

export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>‹</button>
        <span style={S.headerTitle}>关于</span>
        <span style={S.headerSpacer} />
      </div>

      {/* App 信息 */}
      <div style={S.hero}>
        <img src="/icon-192.png" alt="Timeback Calling" style={S.logo} />
        <div style={S.name}>Timeback Calling</div>
        <div style={S.slogan}>让想念的人，随时回到你身边</div>
      </div>

      {/* 免责声明 */}
      <div style={S.section}>
        <div style={S.sectionTitle}>免责声明</div>
        <div style={S.card}>
          <p style={S.p}>1. 数字人的形象与语音由真实人物授权制作，但对话内容全部由人工智能（AI）自动生成，仅用于情感陪伴与纪念，不代表所模仿者本人的真实想法、意愿或立场。</p>
          <p style={S.p}>2. 本产品是情感陪伴工具，不能替代专业医疗、心理咨询等服务。如在使用过程中感到情绪困扰，请及时寻求家人、朋友或专业人士的帮助。</p>
          <p style={S.p}>3. 为保护隐私，数字人的记忆仅保存在本机设备；卸载应用将清空本机记忆。聊天记录在服务端有备份，重新登录后可见。</p>
          <p style={S.p}>4. 视频通话功能需要服务端在线；如遇连接失败，请稍后再试，或联系提供方。</p>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={S.footer}>版本 1.0</div>
    </div>
  );
}

const S = {
  page: { height: '100%', background: W.bg, display: 'flex', flexDirection: 'column' },
  header: {
    background: W.headerBg, padding: 'calc(var(--status-bar-h) + 8px) 12px 8px',
    display: 'flex', alignItems: 'center', gap: 10,
    borderBottom: `0.5px solid ${W.line}`, flexShrink: 0,
  },
  backBtn: { background: 'none', border: 'none', fontSize: 30, color: W.text, cursor: 'pointer', lineHeight: 1, padding: '0 4px', fontFamily: 'inherit' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 600, color: W.text },
  headerSpacer: { width: 38 },
  hero: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '36px 16px 28px', gap: 8,
  },
  logo: { width: 72, height: 72, borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  name: { fontSize: 20, fontWeight: 600, color: W.text },
  slogan: { fontSize: 13, color: W.sub },
  section: { padding: '0 16px' },
  sectionTitle: { fontSize: 13, color: W.sub, margin: '0 0 8px 4px' },
  card: {
    background: W.cell, borderRadius: 8, padding: '16px',
  },
  p: { margin: '0 0 14px', fontSize: 14, lineHeight: 1.7, color: W.text, wordBreak: 'break-word' },
  footer: { textAlign: 'center', fontSize: 12, color: '#B2B2B2', padding: '16px 0 calc(16px + var(--safe-bottom))' },
};
