 import { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./MapView.css";

import {
  searchPlaces,
  getDrivingRoutes,
  formatDistance,
  formatDuration,
} from "../services/mapsApi";

const DEFAULT_LOCATION = [17.385, 78.4867];

const currentLocationIcon = L.divIcon({
  className: "custom-location-marker",
  html: `
    <div class="marker-pin current-pin">
      <div class="marker-center"></div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42],
});

const destinationIcon = L.divIcon({
  className: "custom-destination-marker",
  html: `
    <div class="destination-pin">
      <div class="destination-center"></div>
    </div>
  `,
  iconSize: [46, 46],
  iconAnchor: [23, 46],
  popupAnchor: [0, -46],
});

function MapController({ position }) {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    map.flyTo(position, 14, {
      duration: 1.2,
    });
  }, [position, map]);

  return null;
}

function RouteController({ start, destination }) {
  const map = useMap();

  useEffect(() => {
    if (!start || !destination) {
      return;
    }

    const bounds = L.latLngBounds([
      start,
      destination,
    ]);

    map.fitBounds(bounds, {
      padding: [70, 70],
      maxZoom: 14,
    });
  }, [start, destination, map]);

  return null;
}

function MapView() {
  const [position, setPosition] =
    useState(DEFAULT_LOCATION);

  const [search, setSearch] = useState("");

  const [searchResults, setSearchResults] =
    useState([]);

  const [destination, setDestination] =
    useState(null);

  const [routes, setRoutes] = useState([]);

  const [selectedRouteId, setSelectedRouteId] =
    useState(null);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [routeLoading, setRouteLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [recentSearches, setRecentSearches] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "recentSearches"
          );

        return saved
          ? JSON.parse(saved)
          : [];
      } catch {
        return [];
      }
    });

  const [savedPlaces, setSavedPlaces] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "savedPlaces"
          );

        return saved
          ? JSON.parse(saved)
          : [];
      } catch {
        return [];
      }
    });

  const saveRecentSearch = (place) => {
    setRecentSearches((previous) => {
      const filtered = previous.filter(
        (item) => item.id !== place.id
      );

      const updated = [
        place,
        ...filtered,
      ].slice(0, 5);

      localStorage.setItem(
        "recentSearches",
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  const savePlace = (place) => {
    setSavedPlaces((previous) => {
      const exists = previous.some(
        (item) => item.id === place.id
      );

      if (exists) {
        return previous;
      }

      const updated = [
        ...previous,
        place,
      ].slice(0, 8);

      localStorage.setItem(
        "savedPlaces",
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  const removeSavedPlace = (id) => {
    setSavedPlaces((previous) => {
      const updated = previous.filter(
        (item) => item.id !== id
      );

      localStorage.setItem(
        "savedPlaces",
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  const findMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage(
        "Geolocation is not supported by your browser."
      );

      return;
    }

    setLocationLoading(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        const newPosition = [
          result.coords.latitude,
          result.coords.longitude,
        ];

        setPosition(newPosition);
        setLocationLoading(false);
        setMessage("Your location has been found.");
      },
      () => {
        setLocationLoading(false);
        setMessage(
          "Unable to access your location. Please allow location permission."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const performSearch = async (
    searchText = search
  ) => {
    const query = searchText.trim();

    if (!query) {
      setMessage(
        "Enter a place to search."
      );

      return;
    }

    setSearchLoading(true);
    setMessage("");
    setSearchResults([]);

    try {
      const results = await searchPlaces(
        query,
        position[0],
        position[1]
      );

      if (results.length === 0) {
        setMessage(
          `No places found for "${query}".`
        );

        return;
      }

      setSearchResults(results);
    } catch (error) {
      console.error(error);

      setMessage(
        "Search failed. Please try again."
      );
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    await performSearch(search);
  };

  const selectPlace = async (place) => {
    const destinationPosition = [
      place.latitude,
      place.longitude,
    ];

    setDestination({
      ...place,
      position: destinationPosition,
    });

    setSearchResults([]);
    setMessage("");

    saveRecentSearch(place);

    await calculateRoutes(
      position,
      destinationPosition
    );
  };

  const calculateRoutes = async (
    start,
    destinationPosition
  ) => {
    setRouteLoading(true);
    setRoutes([]);
    setSelectedRouteId(null);

    try {
      const routeData =
        await getDrivingRoutes(
          start,
          destinationPosition
        );

      setRoutes(routeData);

      if (routeData.length > 0) {
        setSelectedRouteId(
          routeData[0].id
        );
      }
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to calculate a driving route."
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const clearRoute = () => {
    setDestination(null);
    setRoutes([]);
    setSelectedRouteId(null);
    setSearchResults([]);
    setMessage("");
  };

  const selectRecentPlace = async (
    place
  ) => {
    setSearch(place.name);

    await selectPlace(place);
  };

  const selectSavedPlace = async (
    place
  ) => {
    setSearch(place.name);

    await selectPlace(place);
  };

  const selectedRoute =
    routes.find(
      (route) =>
        route.id === selectedRouteId
    ) || null;

  return (
    <div className="map-explorer">
      <aside className="explorer-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">
              EXPLORE
            </span>

            <h2>Map Explorer</h2>
          </div>

          {destination && (
            <button
              className="clear-route-button"
              onClick={clearRoute}
            >
              Clear
            </button>
          )}
        </div>

        <div className="search-section">
          <label htmlFor="place-search">
            Search places
          </label>

          <form
            className="search-box"
            onSubmit={handleSearch}
          >
            <span className="search-icon">
              ⌕
            </span>

            <input
              id="place-search"
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search for a place..."
            />

            <button
              type="submit"
              disabled={searchLoading}
            >
              {searchLoading
                ? "..."
                : "Search"}
            </button>
          </form>
        </div>

        <button
          className="location-button"
          onClick={findMyLocation}
          disabled={locationLoading}
        >
          <span>◎</span>

          {locationLoading
            ? "Finding location..."
            : "Use my location"}
        </button>

        {message && (
          <div className="message-box">
            {message}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="results-section">
            <div className="section-heading">
              Search results
            </div>

            <div className="results-list">
              {searchResults.map(
                (place) => (
                  <button
                    className="result-card"
                    key={place.id}
                    onClick={() =>
                      selectPlace(place)
                    }
                  >
                    <span className="result-icon">
                      📍
                    </span>

                    <span className="result-content">
                      <strong>
                        {place.name}
                      </strong>

                      <span>
                        {place.displayName}
                      </span>
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {destination && (
          <>
            <div className="route-header">
              <div>
                <span className="eyebrow">
                  NAVIGATION
                </span>

                <h3>
                  Routes to{" "}
                  {destination.name}
                </h3>
              </div>

              <button
                className="save-button"
                onClick={() =>
                  savePlace(destination)
                }
              >
                ☆ Save
              </button>
            </div>

            {routeLoading ? (
              <div className="route-loading">
                <div className="loading-spinner"></div>
                <span>
                  Finding driving routes...
                </span>
              </div>
            ) : routes.length > 0 ? (
              <div className="routes-section">
                <div className="suggested-label">
                  <span>✦</span>
                  Suggested route
                </div>

                {routes.map(
                  (route, index) => {
                    const isSelected =
                      route.id ===
                      selectedRouteId;

                    return (
                      <button
                        key={route.id}
                        className={`route-card ${
                          isSelected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                          setSelectedRouteId(
                            route.id
                          )
                        }
                      >
                        <div className="route-number">
                          {index + 1}
                        </div>

                        <div className="route-content">
                          <div className="route-title-row">
                            <strong>
                              Route{" "}
                              {index + 1}
                            </strong>

                            {index === 0 && (
                              <span className="recommended-badge">
                                Suggested
                              </span>
                            )}
                          </div>

                          <div className="route-details">
                            <span>
                              🕐{" "}
                              {formatDuration(
                                route.duration
                              )}
                            </span>

                            <span>
                              📏{" "}
                              {formatDistance(
                                route.distance
                              )}
                            </span>
                          </div>
                        </div>

                        <span className="route-arrow">
                          →
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="no-route">
                No driving route found.
              </div>
            )}

            {selectedRoute && (
              <div className="route-summary">
                <div className="summary-item">
                  <span>Distance</span>
                  <strong>
                    {formatDistance(
                      selectedRoute.distance
                    )}
                  </strong>
                </div>

                <div className="summary-item">
                  <span>Estimated time</span>
                  <strong>
                    {formatDuration(
                      selectedRoute.duration
                    )}
                  </strong>
                </div>
              </div>
            )}
          </>
        )}

        {!destination &&
          recentSearches.length > 0 && (
            <div className="saved-section">
              <div className="section-heading">
                Recent searches
              </div>

              <div className="small-list">
                {recentSearches.map(
                  (place) => (
                    <button
                      className="small-place"
                      key={place.id}
                      onClick={() =>
                        selectRecentPlace(
                          place
                        )
                      }
                    >
                      <span>↻</span>
                      <span>
                        {place.name}
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

        {!destination &&
          savedPlaces.length > 0 && (
            <div className="saved-section">
              <div className="section-heading">
                Saved locations
              </div>

              <div className="small-list">
                {savedPlaces.map(
                  (place) => (
                    <div
                      className="saved-place-row"
                      key={place.id}
                    >
                      <button
                        className="small-place"
                        onClick={() =>
                          selectSavedPlace(
                            place
                          )
                        }
                      >
                        <span>★</span>

                        <span>
                          {place.name}
                        </span>
                      </button>

                      <button
                        className="remove-save"
                        onClick={() =>
                          removeSavedPlace(
                            place.id
                          )
                        }
                        title="Remove saved location"
                      >
                        ×
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        <div className="panel-footer">
          <span className="footer-dot"></span>
          Map ready to explore
        </div>
      </aside>

      <section className="map-area">
        <MapContainer
          center={DEFAULT_LOCATION}
          zoom={13}
          scrollWheelZoom={true}
          className="leaflet-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {!destination && (
            <MapController
              position={position}
            />
          )}

          {destination && (
            <RouteController
              start={position}
              destination={
                destination.position
              }
            />
          )}

          <Marker
            position={position}
            icon={currentLocationIcon}
          >
            <Popup>
              <strong>
                Your current location
              </strong>
              <br />
              Starting point
            </Popup>
          </Marker>

          {destination && (
            <Marker
              position={destination.position}
              icon={destinationIcon}
            >
              <Popup>
                <strong>
                  {destination.name}
                </strong>
                <br />
                Destination
              </Popup>
            </Marker>
          )}

          {routes.map((route) => {
            const isSelected =
              route.id ===
              selectedRouteId;

            const coordinates =
              route.geometry.coordinates.map(
                ([longitude, latitude]) => [
                  latitude,
                  longitude,
                ]
              );

            return (
              <Polyline
                key={route.id}
                positions={coordinates}
                pathOptions={{
                  color: isSelected
                    ? "#111827"
                    : "#94a3b8",
                  weight: isSelected
                    ? 7
                    : 5,
                  opacity: isSelected
                    ? 0.95
                    : 0.55,
                  lineCap: "round",
                  lineJoin: "round",
                }}
                eventHandlers={{
                  click: () =>
                    setSelectedRouteId(
                      route.id
                    ),
                }}
              />
            );
          })}
        </MapContainer>

        <div className="map-overlay">
          <div className="map-overlay-title">
            {destination
              ? "Route Preview"
              : "Live Map"}
          </div>

          <div className="map-overlay-subtitle">
            {destination
              ? "Click a route to select it"
              : "Explore locations and plan routes"}
          </div>
        </div>

        <button
          className="floating-location-button"
          onClick={findMyLocation}
          title="Find my location"
        >
          ◎
        </button>

        {selectedRoute && (
          <div className="map-route-info">
            <div>
              <span>
                Suggested route
              </span>

              <strong>
                {formatDuration(
                  selectedRoute.duration
                )}
              </strong>
            </div>

            <div>
              <span>Distance</span>

              <strong>
                {formatDistance(
                  selectedRoute.distance
                )}
              </strong>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default MapView;