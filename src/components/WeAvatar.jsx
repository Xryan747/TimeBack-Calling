// WeChat-style avatar with fallback (gray block + first char of name)
import { useState } from 'react';
import Icon from './Icon';

export default function WeAvatar({ src, name = '', size = 48, radius = 6 }) {
  const [err, setErr] = useState(false);

  if (src && !err) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setErr(true)}
        style={{
          width: size, height: size, borderRadius: radius,
          objectFit: 'cover', flexShrink: 0, background: '#DDD',
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius,
        background: '#CFCFCF', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.45), color: '#fff',
      }}
    >
      {name ? name[0] : <Icon name="user" size={Math.round(size * 0.45)} color="#fff" />}
    </div>
  );
}
