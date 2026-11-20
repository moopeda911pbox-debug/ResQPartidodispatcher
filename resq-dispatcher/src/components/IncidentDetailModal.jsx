import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, MapPin, Navigation, Image as ImageIcon, Video as VideoIcon, Play } from "lucide-react";
import { STATUS, markIncidentViewed } from "../services/incidents";
import { visitingFrom } from "../lib/jurisdiction";
import { fullName, formatPlace } from "../lib/format";
import MediaViewerModal, { orderMedia } from "./MediaViewerModal";
import { useAddress } from "../lib/geocode";

export default function IncidentDetailModal({ incident, onClose }) {
  const navigate = useNavigate();
  const [viewerIndex, setViewerIndex] = useState(null);
  const hasCoords = incident && incident.latitude != null && incident.longitude != null;
  const address = useAddress(
    hasCoords ? incident.latitude : null,
    hasCoords ? incident.longitude : null,
    incident?.address
  );

  // Opening a report that's still open counts as the dispatcher's first look
  // at it (only the very first view is stored). `=== null` rather than a
  // falsy check so nothing is written before the tracking columns exist
  // (the field is then undefined, not null).
  useEffect(() => {
    if (incident && incident.status !== "resolved" && incident.first_viewed_at === null) {
      markIncidentViewed(incident.id);
    }
  }, [incident?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!incident) return null;

  const reporterName = fullName(incident.profiles, "Unknown reporter");
  const media = orderMedia(incident);

  return (
    <>
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div>
            <h2>{incident.incident_type}</h2>
            <span className={`status-pill ${STATUS[incident.status].className}`}>{STATUS[incident.status].label}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="detail-meta">
          <div>
            <span className="label">Reported by</span>
            <p>
              {reporterName}
              {visitingFrom(incident)
                ? ` · visiting from ${formatPlace(visitingFrom(incident))}`
                : incident.profiles?.municipality
                ? ` · ${formatPlace(incident.profiles.municipality)}`
                : ""}
            </p>
          </div>
          {incident.jurisdiction !== undefined && (
            <div>
              <span className="label">Jurisdiction</span>
              <p>{formatPlace(incident.jurisdiction) || "Not in a covered municipality — sent to all dispatchers"}</p>
            </div>
          )}
          <div>
            <span className="label">Submitted</span>
            <p>{new Date(incident.created_at).toLocaleString()}</p>
          </div>
          {hasCoords && (
            <div>
              <span className="label">Location</span>
              <p>
                <MapPin size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                {address || `${incident.latitude.toFixed(6)}, ${incident.longitude.toFixed(6)} (locating address…)`}{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    navigate(`/?navigateTo=${incident.id}`);
                  }}
                  style={{
                    color: "var(--orange)", fontWeight: 600, background: "none", border: "none",
                    padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                    font: "inherit",
                  }}
                >
                  <Navigation size={12} /> Navigate on map
                </button>
              </p>
            </div>
          )}
        </div>

        <div className="detail-section">
          <span className="label">Description</span>
          <p className="detail-description">{incident.description}</p>
        </div>

        <div className="detail-section">
          <span className="label">
            Photos &amp; Videos {media.length > 0 && `(${media.length})`}
          </span>

          {media.length === 0 ? (
            <p className="empty-state" style={{ padding: "16px 0" }}>
              No photos or videos were attached to this report.
            </p>
          ) : (
            <div className="media-grid">
              {media.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className="media-thumb"
                  onClick={() => setViewerIndex(i)}
                  aria-label={m.file_type === "video" ? "Play video" : "View photo"}
                >
                  {m.file_type === "video" ? (
                    <>
                      <video src={m.file_url} preload="metadata" muted />
                      <span className="play-badge"><Play size={26} /></span>
                      <span className="media-tag"><VideoIcon size={11} /> Video</span>
                    </>
                  ) : (
                    <>
                      <img src={m.file_url} alt="Incident photo" />
                      <span className="media-tag"><ImageIcon size={11} /> Photo</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {viewerIndex != null && (
      <MediaViewerModal
        items={media}
        startIndex={viewerIndex}
        title={incident.incident_type}
        onClose={() => setViewerIndex(null)}
      />
    )}
    </>
  );
}
