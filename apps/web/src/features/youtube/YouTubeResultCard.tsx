import React from 'react';
import { ChevronDown, ChevronUp, Download, Music, Video, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormatPills } from '@/components/tool/FormatPills';
import { useShallow } from 'zustand/react/shallow';
import { getBitrateOptions, useYouTubeStore } from './youtubeStore';

export const YouTubeResultCard: React.FC = () => {
  // Pick fields with useShallow so download progress ticks don't re-render this card.
  const {
    info,
    mode,
    selectedQuality,
    selectedFormat,
    selectedBitrate,
    trimStart,
    trimEnd,
    embedThumbnail,
    embedMetadata,
    showAdvanced,
    setMode,
    setQuality,
    setFormat,
    setBitrate,
    setTrimStart,
    setTrimEnd,
    setEmbedThumbnail,
    setEmbedMetadata,
    toggleAdvanced,
    startDownload,
    reset,
  } = useYouTubeStore(
    useShallow((s) => ({
      info: s.info,
      mode: s.mode,
      selectedQuality: s.selectedQuality,
      selectedFormat: s.selectedFormat,
      selectedBitrate: s.selectedBitrate,
      trimStart: s.trimStart,
      trimEnd: s.trimEnd,
      embedThumbnail: s.embedThumbnail,
      embedMetadata: s.embedMetadata,
      showAdvanced: s.showAdvanced,
      setMode: s.setMode,
      setQuality: s.setQuality,
      setFormat: s.setFormat,
      setBitrate: s.setBitrate,
      setTrimStart: s.setTrimStart,
      setTrimEnd: s.setTrimEnd,
      setEmbedThumbnail: s.setEmbedThumbnail,
      setEmbedMetadata: s.setEmbedMetadata,
      toggleAdvanced: s.toggleAdvanced,
      startDownload: s.startDownload,
      reset: s.reset,
    }))
  );

  if (!info) return null;

  const videoQualityOutputs = info.videoFormats.map((f) => ({
    value: `${f.height}p`,
    label: f.filesizeApproxMB ? `${f.height}p (~${f.filesizeApproxMB}MB)` : `${f.height}p`,
  }));

  const videoFormatOutputs = [
    { value: 'MP4', label: 'MP4' },
    { value: 'WEBM', label: 'WEBM' },
  ];
  const audioFormatOutputs = [
    { value: 'MP3', label: 'MP3' },
    { value: 'M4A', label: 'M4A' },
    { value: 'WAV', label: 'WAV' },
    { value: 'OPUS', label: 'OPUS' },
  ];
  const audioBitrateOutputs = getBitrateOptions(info, selectedFormat).map((b) => ({
    value: `${b}k`,
    label: `${b}k`,
  }));

  return (
    <div className="w-full bg-surface border border-border rounded-card p-5 sm:p-6 mb-8 shadow-sm">
      {/* Video Header: Thumbnail + Meta */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {info.thumbnailUrl && (
          <div className="relative shrink-0 w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-bg border border-border">
            <img
              src={info.thumbnailUrl}
              alt={info.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-black/80 text-white">
              {info.durationFormatted}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-text line-clamp-2 mb-1">
              {info.title}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              {info.channel}
              {info.viewCount && (
                <span> · {Number(info.viewCount).toLocaleString()} views</span>
              )}
            </p>
          </div>

          {info.tooLong && (
            <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-sans">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Video exceeds {info.maxDurationMin} min cap. Only audio download is supported.</span>
            </div>
          )}
        </div>
      </div>

      {/* Segmented Mode Control: Video | Audio */}
      <div className="mb-6">
        <label className="block text-xs font-mono text-text-muted uppercase mb-2">
          Download Mode
        </label>
        <div className="inline-flex p-1 rounded-chip bg-bg border border-border">
          <button
            type="button"
            disabled={info.tooLong}
            onClick={() => setMode('video')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-chip text-xs font-sans font-medium transition-colors ${
              mode === 'video'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            Video
          </button>
          <button
            type="button"
            onClick={() => setMode('audio')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-chip text-xs font-sans font-medium transition-colors ${
              mode === 'audio'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Audio only
          </button>
        </div>
      </div>

      {/* Mode Specific Format Options */}
      {mode === 'video' && !info.tooLong ? (
        <div className="space-y-4 mb-6">
          {videoQualityOutputs.length > 0 && (
            <FormatPills
              label="Quality"
              outputs={videoQualityOutputs}
              selectedFormat={
                selectedQuality
                  ? `${selectedQuality}p`
                  : `${info.videoFormats[0]?.height}p`
              }
              onSelectFormat={(val: string) =>
                setQuality(parseInt(val.replace('p', ''), 10))
              }
            />
          )}

          <FormatPills
            label="Container Format"
            outputs={videoFormatOutputs}
            selectedFormat={selectedFormat.toUpperCase()}
            onSelectFormat={(val: string) => setFormat(val.toLowerCase())}
          />
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          <FormatPills
            label="Audio Format"
            outputs={audioFormatOutputs}
            selectedFormat={selectedFormat.toUpperCase()}
            onSelectFormat={(val: string) => setFormat(val.toLowerCase())}
          />

          {audioBitrateOutputs.length > 0 && (
            <FormatPills
              label="Bitrate"
              outputs={audioBitrateOutputs}
              selectedFormat={`${selectedBitrate}k`}
              onSelectFormat={(val: string) =>
                setBitrate(parseInt(val.replace('k', ''), 10))
              }
            />
          )}
        </div>
      )}

      {/* Advanced Options Accordion */}
      <div className="mb-6 pt-4 border-t border-border">
        <button
          type="button"
          onClick={toggleAdvanced}
          className="flex items-center gap-1.5 text-xs font-mono text-text-muted hover:text-text transition-colors"
        >
          {showAdvanced ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          Advanced options
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pl-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-sm">
              <div>
                <label className="block text-xs text-text-muted font-sans mb-1">
                  Trim Start (hh:mm:ss)
                </label>
                <input
                  type="text"
                  placeholder="00:00:00"
                  value={trimStart}
                  onChange={(e) => setTrimStart(e.target.value)}
                  className="w-full h-8 px-2.5 rounded bg-bg border border-border text-xs text-text font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted font-sans mb-1">
                  Trim End (hh:mm:ss)
                </label>
                <input
                  type="text"
                  placeholder="00:02:30"
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(e.target.value)}
                  className="w-full h-8 px-2.5 rounded bg-bg border border-border text-xs text-text font-mono focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                <input
                  type="checkbox"
                  checked={embedThumbnail}
                  onChange={(e) => setEmbedThumbnail(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Embed video thumbnail
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-text">
                <input
                  type="checkbox"
                  checked={embedMetadata}
                  onChange={(e) => setEmbedMetadata(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                Embed metadata tags (title, artist, year)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          onClick={startDownload}
          className="w-full sm:w-auto px-6 h-10 font-sans font-medium flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </Button>

        <Button
          variant="outline"
          onClick={reset}
          className="w-full sm:w-auto h-10 text-xs font-sans text-text-muted hover:text-text"
        >
          Try another link
        </Button>
      </div>
    </div>
  );
};
