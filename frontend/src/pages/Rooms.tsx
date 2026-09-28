import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  fetchRooms,
  getResourceEtag,
  getLastSyncTime
} from '../api/client';
import type { Room } from '../types';
import { CardSkeleton } from '../components/LoadingSkeleton';
import {
  Users,
  MapPin,
  Search,
  RefreshCw,
  Clock
} from 'lucide-react';

interface RoomsProps {
  onNavigate: (tab: string, entityId?: string) => void;
}

export const Rooms: React.FC<RoomsProps> = ({ onNavigate }) => {
  const {
    activePersonaKey,
    loading: authLoading
  } = useAuth();

  const { showError } = useToast();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [capacityFilter, setCapacityFilter] =
    useState<string>('all');

  // ============================================================
  // ETag Polling & Sync State
  // ============================================================

  const [lastSyncTime, setLastSyncTime] =
    useState<Date | null>(
      () => getLastSyncTime('/v1/rooms')
    );

  const [currentEtag, setCurrentEtag] =
    useState<string | null>(
      () => getResourceEtag('/v1/rooms')
    );

  const [isStale, setIsStale] =
    useState<boolean>(false);

  const [isPolling, setIsPolling] =
    useState<boolean>(false);

  const isFetchingRef =
    useRef<boolean>(false);

  // ============================================================
  // Load Rooms
  // ============================================================

  const loadRooms = async (
    isBackground = false
  ) => {
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    if (!isBackground) {
      setLoading(true);
    } else {
      setIsPolling(true);
    }

    try {
      const data = await fetchRooms();

      setRooms(data);
      setLastSyncTime(new Date());

      setCurrentEtag(
        getResourceEtag('/v1/rooms')
      );

      setIsStale(false);
    } catch (err: unknown) {
      if (isBackground) {
        setIsStale(true);
      } else {
        showError(err as Error);
      }
    } finally {
      setLoading(false);
      setIsPolling(false);
      isFetchingRef.current = false;
    }
  };

  // ============================================================
  // Initial Load + Background Polling
  // ============================================================

  useEffect(() => {
    if (authLoading) {
      return;
    }

    loadRooms(false);

    // Poll every 12 seconds
    const interval = setInterval(() => {
      loadRooms(true);
    }, 12000);

    return () => {
      clearInterval(interval);
    };
  }, [activePersonaKey, authLoading]);

  // ============================================================
  // Search + Capacity Filter
  // ============================================================

  const filteredRooms = rooms.filter((room) => {
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      room.name.toLowerCase().includes(query) ||
      room.location.toLowerCase().includes(query) ||
      room.id.toLowerCase().includes(query);

    const matchesCapacity =
      capacityFilter === 'all' ||
      (
        capacityFilter === 'small' &&
        room.capacity <= 2
      ) ||
      (
        capacityFilter === 'medium' &&
        room.capacity > 2 &&
        room.capacity <= 4
      ) ||
      (
        capacityFilter === 'large' &&
        room.capacity > 4
      );

    return matchesSearch && matchesCapacity;
  });

  // ============================================================
  // Render
  // ============================================================

  return (
    <div>

      {/* ========================================================
          PAGE HEADER
      ======================================================== */}

      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h1 className="page-title">
            Study Rooms & Pods
          </h1>

          <p className="page-subtitle">
            Browse quiet, group, and presentation study
            spaces available in the library.
          </p>
        </div>

        {/* ======================================================
            ETag Sync Status
        ====================================================== */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.82rem',
              fontWeight: 500,
              background: isStale
                ? 'rgba(234, 88, 12, 0.12)'
                : 'rgba(16, 185, 129, 0.12)',
              color: isStale
                ? '#ea580c'
                : '#059669',
              border: `1px solid ${
                isStale
                  ? 'rgba(234, 88, 12, 0.25)'
                  : 'rgba(16, 185, 129, 0.25)'
              }`
            }}
          >
            {isStale ? (
              <>
                <Clock size={14} />

                <span>
                  Showing data from{' '}
                  {lastSyncTime
                    ? lastSyncTime.toLocaleTimeString(
                        [],
                        {
                          hour: '2-digit',
                          minute: '2-digit'
                        }
                      )
                    : 'earlier'}
                  {' · Reconnecting...'}
                </span>
              </>
            ) : (
              <>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#10b981',
                    display: 'inline-block',
                    boxShadow:
                      '0 0 0 2px rgba(16, 185, 129, 0.3)'
                  }}
                />

                <span>
                  {lastSyncTime
                    ? `Updated ${lastSyncTime.toLocaleTimeString(
                        [],
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        }
                      )}`
                    : 'Updated just now'}

                  {currentEtag &&
                    ` · ETag: ${currentEtag
                      .replace(/^W\//, '')
                      .slice(0, 12)}...`}
                </span>
              </>
            )}
          </div>

          <button
            className="btn btn-sm btn-outline"
            onClick={() => loadRooms(true)}
            disabled={isPolling}
            title="Poll collection using ETag (If-None-Match)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px'
            }}
          >
            <RefreshCw
              size={14}
              style={{
                animation: isPolling
                  ? 'spin 1s linear infinite'
                  : 'none'
              }}
            />

            <span>
              {isPolling
                ? 'Polling...'
                : 'Sync Now'}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================
          SEARCH + FILTER
      ======================================================== */}

      <div
        className="card"
        style={{
          marginBottom: '28px',
          padding: '16px 20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}
      >
        {/* Search */}

        <div
          style={{
            position: 'relative',
            flex: '1 1 240px'
          }}
        >
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '12px',
              color: 'var(--text-muted)'
            }}
          />

          <input
            type="text"
            className="form-input"
            style={{
              paddingLeft: '38px'
            }}
            placeholder="Search by room name or wing..."
            value={searchQuery}
            onChange={(e) =>
              setSearchQuery(e.target.value)
            }
          />
        </div>

        {/* Capacity */}

        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-muted)'
            }}
          >
            Capacity:
          </span>

          <select
            className="form-select"
            style={{
              width: 'auto',
              padding: '8px 12px'
            }}
            value={capacityFilter}
            onChange={(e) =>
              setCapacityFilter(e.target.value)
            }
          >
            <option value="all">
              All Sizes
            </option>

            <option value="small">
              Small Pod (1–2 persons)
            </option>

            <option value="medium">
              Medium Room (3–4 persons)
            </option>

            <option value="large">
              Large Group (5+ persons)
            </option>
          </select>
        </div>
      </div>

      {/* ========================================================
          ROOMS
      ======================================================== */}

      {loading ? (
        <div className="grid-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="empty-state">
          <Search className="empty-icon" />

          <h3
            style={{
              fontSize: '1.1rem',
              fontWeight: 700,
              marginBottom: '6px'
            }}
          >
            No Rooms Match Your Search
          </h3>

          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.9rem'
            }}
          >
            Try clearing the search query or
            capacity filter.
          </p>
        </div>
      ) : (
        <div className="grid-3">

          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}
            >

              {/* ==================================================
                  ROOM HEADER
              ================================================== */}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: 'var(--primary-900)'
                    }}
                  >
                    {room.name}
                  </h3>

                  <span
                    className="font-mono"
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-dim)'
                    }}
                  >
                    {room.id}
                  </span>
                </div>

                <span className="badge badge-scope">
                  <Users size={12} />

                  {room.capacity} seats
                </span>
              </div>

              {/* ==================================================
                  LOCATION
              ================================================== */}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '16px'
                }}
              >
                <MapPin size={15} />

                <span>
                  {room.location}
                </span>
              </div>

              {/* ==================================================
                  AMENITIES
              ================================================== */}

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginBottom: '24px'
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '4px',
                    color: 'var(--text-muted)'
                  }}
                >
                  ⚡ Power Outlets
                </span>

                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '4px',
                    color: 'var(--text-muted)'
                  }}
                >
                  📶 High-Speed WiFi
                </span>

                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    background: 'var(--bg-subtle)',
                    borderRadius: '4px',
                    color: 'var(--text-muted)'
                  }}
                >
                  🖥️ Presentation Screen
                </span>
              </div>

              {/* ==================================================
                  NAVIGATION
                  
                  IMPORTANT:
                  Reserve Space -> Room Detail
                  Details      -> Room Detail

                  Reservation is handled in RoomDetail.tsx.
              ================================================== */}

              <div
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  gap: '8px',
                  paddingTop: '16px',
                  borderTop:
                    '1px solid var(--border)'
                }}
              >
                <button
                  className="btn btn-primary"
                  style={{
                    flex: 1
                  }}
                  onClick={() =>
                    onNavigate(
                      'room-detail',
                      room.id
                    )
                  }
                >
                  Reserve Space
                </button>

                <button
                  className="btn btn-outline"
                  onClick={() =>
                    onNavigate(
                      'room-detail',
                      room.id
                    )
                  }
                >
                  Details
                </button>
              </div>

            </div>
          ))}

        </div>
      )}

    </div>
  );
};