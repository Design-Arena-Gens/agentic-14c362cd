'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import classNames from 'classnames';
import { PaletteStrip } from '@/components/PaletteStrip';
import { extractPalette } from '@/lib/palette';

const modes = [
  {
    id: 'remix',
    name: 'Prompt Remix',
    description: 'Transform the visual style with natural language guidance using InstructPix2Pix.',
    accent: 'bg-neon-pink'
  },
  {
    id: 'background',
    name: 'Smart Cutout',
    description: 'Remove backgrounds using Hugging Face RMBG for instant transparent PNGs.',
    accent: 'bg-neon-blue'
  },
  {
    id: 'palette',
    name: 'Palette Muse',
    description: 'Extract a brand-ready palette from your uploaded imagery.',
    accent: 'bg-neon-green'
  }
] as const;

type ModeId = (typeof modes)[number]['id'];

const defaultPrompt = "Photorealistic studio lighting, high contrast, cinematic color grading";

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function usePersistentKey() {
  const [token, setToken] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const stored = window.localStorage.getItem('prismforge:hf-token');
    if (stored) setToken(stored);
  }, []);

  const update = useCallback((value: string, persist: boolean) => {
    setToken(value);
    if (persist) {
      window.localStorage.setItem('prismforge:hf-token', value);
    }
  }, []);

  return { token, setToken: update };
}

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<ModeId>('remix');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string>('');
  const [resultPreview, setResultPreview] = useState<string>('');
  const [prompt, setPrompt] = useState<string>(defaultPrompt);
  const [guidance, setGuidance] = useState<number>(1.5);
  const [palette, setPalette] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [rememberToken, setRememberToken] = useState<boolean>(false);
  const { token: apiKey, setToken } = usePersistentKey();

  const hasImage = useMemo(() => Boolean(sourcePreview), [sourcePreview]);

  useEffect(() => {
    if (!rememberToken) return;
    if (apiKey) {
      window.localStorage.setItem('prismforge:hf-token', apiKey);
    }
  }, [rememberToken, apiKey]);

  const showToast = useCallback((value: ToastState | null) => {
    setToast(value);
    if (value) {
      const timer = window.setTimeout(() => setToast(null), 5000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const resetOutputs = useCallback(() => {
    setResultPreview('');
    setPalette([]);
    setToast(null);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith('image/')) {
        showToast({ type: 'error', message: 'Please drop an image file.' });
        return;
      }

      setSourceFile(file);
      const dataUrl = await fileToDataUrl(file);
      setSourcePreview(dataUrl);
      resetOutputs();
    },
    [fileToDataUrl, resetOutputs, showToast]
  );

  const onDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer.files;
      await handleFiles(files);
    },
    [handleFiles]
  );

  const onBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      await handleFiles(files);
    },
    [handleFiles]
  );

  const runBackgroundRemoval = useCallback(async () => {
    if (!sourcePreview) return;
    if (!apiKey) {
      showToast({ type: 'error', message: 'Add a Hugging Face API token to remove backgrounds.' });
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: sourcePreview,
          apiKey,
          mode: 'background'
        })
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(msg.error ?? 'Background removal failed');
      }

      const data = (await res.json()) as { image: string };
      setResultPreview(data.image);
      showToast({ type: 'success', message: 'Background removed with AI precision.' });
    } catch (error) {
      console.error(error);
      showToast({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Smart Cutout failed. Try a subject with clear edges.'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [apiKey, showToast, sourcePreview]);

  const runPaletteExtraction = useCallback(async () => {
    if (!sourcePreview) return;
    setIsProcessing(true);
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      const palettePromise = new Promise<string[]>((resolve, reject) => {
        img.onload = async () => {
          try {
            const colors = await extractPalette(img, 6);
            resolve(colors);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = reject;
      });
      img.src = sourcePreview;
      const colors = await palettePromise;
      setPalette(colors);
      showToast({ type: 'success', message: 'Palette extracted for your brand kit.' });
    } catch (error) {
      console.error(error);
      showToast({ type: 'error', message: 'Palette extraction failed. Try another image.' });
    } finally {
      setIsProcessing(false);
    }
  }, [sourcePreview, showToast]);

  const runPromptRemix = useCallback(async () => {
    if (!sourcePreview) return;
    if (!apiKey) {
      showToast({ type: 'error', message: 'Add a Hugging Face API token to run prompt remixing.' });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: sourcePreview,
          prompt,
          apiKey,
          guidance,
          mode: 'remix'
        })
      });

      if (!res.ok) {
        const msg = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(msg.error ?? 'Failed to generate edit');
      }

      const data = (await res.json()) as { image: string };
      setResultPreview(data.image);
      showToast({ type: 'success', message: 'Prompt remix complete. Download or iterate again!' });
    } catch (error) {
      console.error(error);
      showToast({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Remix failed. Adjust prompt or guidance scale and retry.'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [apiKey, guidance, prompt, showToast, sourcePreview]);

  const handleProcess = useCallback(async () => {
    if (!hasImage) {
      showToast({ type: 'error', message: 'Upload an image to start editing.' });
      return;
    }

    switch (mode) {
      case 'remix':
        await runPromptRemix();
        break;
      case 'background':
        await runBackgroundRemoval();
        break;
      case 'palette':
        await runPaletteExtraction();
        break;
      default:
        break;
    }
  }, [hasImage, mode, runBackgroundRemoval, runPaletteExtraction, runPromptRemix, showToast]);

  const downloadResult = useCallback(() => {
    if (!resultPreview) return;
    const link = document.createElement('a');
    link.href = resultPreview;
    link.download = 'prismforge-output.png';
    link.click();
  }, [resultPreview]);

  const features = useMemo(
    () => [
      {
        title: 'Creative Workflows',
        description: 'Branch-friendly exports for hero banners, social drops, and UI mockups.'
      },
      {
        title: 'Batch Ready',
        description: 'Queue multiple prompts and iterate fast with consistent parameters.'
      },
      {
        title: 'Team Safe',
        description: 'API keys stay client-side; nothing is stored on our servers.'
      }
    ],
    []
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-12">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-10 shadow-[0_35px_80px_-45px_rgba(77,208,225,0.35)]">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="rounded-full border border-white/20 bg-black/40 px-4 py-1 text-xs uppercase tracking-[0.4em] text-slate-300">
              PrismForge Studio
            </span>
            <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
              AI image editing built for creatives and high-velocity product teams.
            </h1>
            <p className="text-lg text-slate-300">
              Remix, refine, and productionize visuals in minutes. Blend prompt-driven edits, smart background isolation, and brand palette extraction in a single canvas.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-slate-300">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-black/30 p-4 shadow-inner shadow-black/40"
              >
                <p className="text-sm font-semibold text-white">{feature.title}</p>
                <p className="mt-1 text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-12 lg:grid-cols-[0.75fr_1fr]">
        <div className="space-y-5">
          <div className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.4em] text-slate-400">Workflow</span>
            <h2 className="text-2xl font-semibold">Choose your editing mode</h2>
          </div>
          <div className="grid gap-3">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMode(item.id)}
                className={classNames(
                  'group flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/40',
                  {
                    'border-neon-blue/60 shadow-glow ring-2 ring-neon-blue/40': mode === item.id
                  }
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={classNames('inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-semibold', item.accent)}
                  >
                    {item.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-base font-semibold text-white">{item.name}</p>
                    <p className="text-sm text-slate-300">{item.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {mode === 'remix' && (
            <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white" htmlFor="prompt">
                  Prompt
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe how you want to transform the image"
                  className="min-h-[120px] rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-neon-blue"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-white" htmlFor="guidance">
                  Guidance scale ({guidance.toFixed(1)})
                </label>
                <input
                  id="guidance"
                  type="range"
                  min={0.5}
                  max={2.5}
                  step={0.1}
                  value={guidance}
                  onChange={(event) => setGuidance(Number(event.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-slate-400">Lower values keep the original look; higher values follow the prompt closely.</p>
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white" htmlFor="api-key">
                    Hugging Face API token
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberToken}
                      onChange={(event) => {
                        setRememberToken(event.target.checked);
                        if (!event.target.checked) {
                          window.localStorage.removeItem('prismforge:hf-token');
                        }
                      }}
                      className="h-3.5 w-3.5 rounded border-white/20 bg-black/50"
                    />
                    Remember locally
                  </label>
                </div>
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setToken(event.target.value, rememberToken)}
                  placeholder="hf_..."
                  className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-neon-blue"
                />
                <p className="text-xs text-slate-400">
                  Required for prompt remixing. Generate a token at huggingface.co/settings/tokens with Inference permissions.
                </p>
              </div>
            </div>
          )}

          {mode === 'background' && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              <p className="font-medium text-white">Tip</p>
              <p className="mt-1">
                Transparent PNG exports powered by BRIA RMBG on Hugging Face. Tokens stay local—bring your own Hugging Face key.
              </p>
            </div>
          )}

          {mode === 'palette' && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              <p className="font-medium text-white">Creative hint</p>
              <p className="mt-1">Drop campaign mood boards to instantly capture palettes for web themes and design systems.</p>
            </div>
          )}
        </div>

        <div className="grid gap-5">
          <div
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className={classNames(
              'group relative flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/20 bg-black/30 text-center transition',
              {
                'border-neon-blue/60 shadow-glow': !hasImage
              }
            )}
          >
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={onFileChange} />
            {!hasImage ? (
              <div className="space-y-3 px-6">
                <p className="text-lg font-medium text-white">Drop an image or import from your device</p>
                <p className="text-sm text-slate-300">
                  Supports PNG, JPG, and WebP up to 10MB. We process everything in-memory for privacy.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={onBrowseClick}
                    className="rounded-full bg-neon-blue px-5 py-2 text-sm font-semibold text-black transition hover:bg-neon-blue/90"
                  >
                    Browse files
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 p-4">
                <div className="relative mx-auto h-[260px] w-full max-w-xl overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={sourcePreview}
                    alt="Source"
                    fill
                    className="object-contain"
                    sizes="(min-width: 1024px) 50vw, 90vw"
                  />
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 px-3 py-1">{sourceFile?.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className="rounded-full border border-white/10 px-3 py-1 transition hover:border-white/40 hover:text-white"
                  >
                    Replace image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSourceFile(null);
                      setSourcePreview('');
                      resetOutputs();
                    }}
                    className="rounded-full border border-white/10 px-3 py-1 transition hover:border-white/40 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-slate-300">
              {mode === 'remix' && 'Describe your desired transformation and run Prompt Remix.'}
              {mode === 'background' && 'Cut the subject loose with Smart Cutout background removal.'}
              {mode === 'palette' && 'Extract a signature color story from your artwork.'}
            </div>
            <button
              type="button"
              onClick={handleProcess}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/60"
            >
              {isProcessing ? 'Processing…' : 'Run' }
            </button>
          </div>

          {toast && (
            <div
              className={classNames(
                'rounded-2xl border p-4 text-sm shadow-lg',
                toast.type === 'success'
                  ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                  : 'border-rose-400/40 bg-rose-400/15 text-rose-200'
              )}
            >
              {toast.message}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Input</span>
                <span>{hasImage ? 'Ready' : 'Waiting for upload'}</span>
              </div>
              <div className="relative h-64 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {hasImage ? (
                  <Image src={sourcePreview} alt="Input" fill className="object-contain" sizes="(min-width: 1024px) 25vw, 80vw" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">No input</div>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Output</span>
                <div className="flex items-center gap-2">
                  <span>{resultPreview ? 'Generated' : 'Awaiting run'}</span>
                  <button
                    type="button"
                    onClick={downloadResult}
                    disabled={!resultPreview}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition enabled:hover:border-white/40 enabled:hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:text-slate-500"
                  >
                    Download
                  </button>
                </div>
              </div>
              <div className="relative h-64 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {resultPreview ? (
                  <Image src={resultPreview} alt="Output" fill className="object-contain" sizes="(min-width: 1024px) 25vw, 80vw" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">Run a mode to see the result</div>
                )}
              </div>
            </div>
          </div>

          <PaletteStrip
            colors={palette}
            onColorSelect={(color) => {
              navigator.clipboard
                .writeText(color)
                .then(() => showToast({ type: 'success', message: `${color} copied to clipboard.` }))
                .catch(() => showToast({ type: 'error', message: 'Unable to copy color.' }));
            }}
          />
        </div>
      </section>
    </main>
  );
}
