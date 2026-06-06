import React, { useState, useEffect } from 'react';
import { shouldForceUpdate, type ForceUpdateConfig } from '../services/appVersionService';
import ForceUpdateModal from './ForceUpdateModal';

/**
 * Shows a dismissible update prompt when Firestore minimumVersion is above the installed app.
 * User can tap Later, close, or outside - app keeps working.
 */
const VersionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prompt, setPrompt] = useState<{
    config: ForceUpdateConfig;
    currentVersion: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    shouldForceUpdate()
      .then((r) => {
        if (cancelled) return;
        if (r.force && r.config) {
          setPrompt({ config: r.config, currentVersion: r.currentVersion });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      {prompt != null && (
        <ForceUpdateModal
          visible
          config={prompt.config}
          currentVersion={prompt.currentVersion}
          onDismiss={() => setPrompt(null)}
        />
      )}
    </>
  );
};

export default VersionGate;
