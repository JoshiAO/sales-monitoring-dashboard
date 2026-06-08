import React from 'react';

interface FireEffectProps {
  type: string; // 'fire-red', 'fire-orange', 'fire-blue', or ''
}

const FireEffect: React.FC<FireEffectProps> = ({ type }) => {
  if (!type) return null;

  const style: React.CSSProperties = {
    position: 'absolute',
    bottom: '-20%',
    left: 0,
    width: '100%',
    height: '120%',
    objectFit: 'cover',
    pointerEvents: 'none',
    zIndex: 0,
    mixBlendMode: 'screen',
    opacity: 0.85
  };

  // Low Tier
  if (type === 'fire-red') {
    return <img src="/animations/Tier3.gif" alt="fire" style={style} />;
  }

  // Mid Tier
  if (type === 'fire-orange') {
    return (
      <video 
        src="/animations/Tier2.mp4" 
        autoPlay 
        loop 
        muted 
        playsInline 
        style={style} 
      />
    );
  }

  // High Tier
  if (type === 'fire-blue') {
    return <img src="/animations/Tier1.svg" alt="fire" style={style} />;
  }

  return null;
};

export default FireEffect;
