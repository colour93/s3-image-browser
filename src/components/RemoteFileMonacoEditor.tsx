import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";

export const RemoteFileMonacoEditor: React.FC<{ url: string }> = ({ url }) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getLanguageFromUrl = (url: string) => {
    if (url.endsWith('.ts')) return 'typescript';
    if (url.endsWith('.js')) return 'javascript';
    if (url.endsWith('.json')) return 'json';
    if (url.endsWith('.css')) return 'css';
    if (url.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  useEffect(() => {
    if (!url) return;
    setLoading(true);
    setError(null);

    fetch('/api/proxy', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.text();
      })
      .then((text) => setValue(text))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [url]);

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (loading) return <div>Loading...</div>;

  return (
    <Editor
      value={value}
      language={getLanguageFromUrl(url)}
      options={{
        minimap: { enabled: true },
        readOnly: true,

      }}
      height='100%'
    />
  );
};
