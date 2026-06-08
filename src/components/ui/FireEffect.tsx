import React from 'react';

interface FireEffectProps {
  type: string; // 'fire-red', 'fire-orange', 'fire-blue', or ''
}

const FireEffect: React.FC<FireEffectProps> = ({ type }) => {
  if (!type) return null;

  return (
    <div className={`fire-fx ${type}`}>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
      <div className="particle"></div>
    </div>
  );
};

export default FireEffect;
