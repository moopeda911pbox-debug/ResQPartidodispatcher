import React, { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Play, ExternalLink } from "lucide-react";

// Photos first, then videos — the same order everywhere a report's media is listed.
export function orderMedia(incident) {
  const media = incident?.incident_media ?? [];
  return [...media.filter((m) => m.file_type === "photo"), ...media.filter((m) => m.file_type === "video")];
}

export default function MediaViewerModal({ items, startIndex = 0, title, onClose }) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)));
  const current = items[index];
  const many = items.length > 1;

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => (i + 1) % items.length);
      else if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + items.length) % items.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  if (!current) return null;
  const isVideo = current.file_type === "video";

  return (
    <div className="media-viewer-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="media-viewer-bar" onClick={(e) => e.stopPropagation()}>
        <div className="media-viewer-title">
          {title || "Attachments"} <span>· {isVideo ? "Video" : "Photo"} {index + 1} of {items.length}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!isVideo && (
            <a className="icon-btn light" href={current.file_url} target="_blank" rel="noreferrer" title="Open original" aria-label="Open original">
              <ExternalLink size={17} />
            </a>
          )}
          <button className="icon-btn light" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="media-viewer-stage" onClick={(e) => e.stopPropagation()}>
        {many && (
          <button className="media-viewer-nav left" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)} aria-label="Previous">
            <ChevronLeft size={26} />
          </button>
        )}
        {isVideo ? (
          <video key={current.id} src={current.file_url} controls autoPlay playsInline className="media-viewer-content" />
        ) : (
          <img key={current.id} src={current.file_url} alt="Incident attachment" className="media-viewer-content" />
        )}
        {many && (
          <button className="media-viewer-nav right" onClick={() => setIndex((i) => (i + 1) % items.length)} aria-label="Next">
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      {many && (
        <div className="media-viewer-strip" onClick={(e) => e.stopPropagation()}>
          {items.map((m, i) => (
            <button key={m.id} className={`media-viewer-thumb${i === index ? " active" : ""}`} onClick={() => setIndex(i)} aria-label={`Show item ${i + 1}`}>
              {m.file_type === "video" ? (
                <span className="vid"><Play size={14} /></span>
              ) : (
                <img src={m.file_url} alt="" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
