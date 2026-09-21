import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div className="skeleton" style={{ height: '24px', width: '60%' }} />
      <div className="skeleton" style={{ height: '16px', width: '90%' }} />
      <div className="skeleton" style={{ height: '16px', width: '75%' }} />
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <div className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '36px', width: '80px', borderRadius: '8px' }} />
      </div>
    </div>
  );
};

export const TableRowSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ height: '20px', width: '120px' }} />
      <div className="skeleton" style={{ height: '20px', width: '180px' }} />
      <div className="skeleton" style={{ height: '20px', width: '100px' }} />
      <div className="skeleton" style={{ height: '20px', width: '80px', marginLeft: 'auto' }} />
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', gap: '16px', borderBottom: '2px solid var(--border)', paddingBottom: '10px' }}>
        <div className="skeleton" style={{ height: '18px', width: '20%' }} />
        <div className="skeleton" style={{ height: '18px', width: '30%' }} />
        <div className="skeleton" style={{ height: '18px', width: '25%' }} />
        <div className="skeleton" style={{ height: '18px', width: '15%', marginLeft: 'auto' }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </div>
  );
};
