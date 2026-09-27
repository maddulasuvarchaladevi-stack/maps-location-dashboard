 import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  LayersControl,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./MapView.css";

import {
  searchPlaces,
  getDrivingRoute,
} from "../services/mapsApi";

const defaultPosition = [17.385, 78.4867];

function LocationController({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 15);
    }
  }, [position, map]);

  return null;
}

function RouteController({ coordinates }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length > 0) {
      map.fitBounds(coordinates, {
        padding: [50, 50],
      });
    }
  }, [coordinates, map]);

  return null;
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function MapView() {
  const [userPosition, setUserPosition] = useState(null);
  const [selectedLocation, setSelectedLocation] =
    useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] =
    useState([]);

  const [isSearching, setIsSearching] =
    useState(false);
  const [searchError, setSearchError] =
    useState("");

  const [routeCoordinates, setRouteCoordinates] =
    useState([]);
  const [routeInfo, setRouteInfo] =
    useState(null);
  const [routeLoading, setRouteLoading] =
    useState(false);
  const [routeError, setRouteError] =
    useState("");

  const [savedLocations, setSavedLocations] =
    useState(() => {
      const saved =
        localStorage.getItem("savedLocations");

      return saved ? JSON.parse(saved) : [];
    });

  const [recentSearches, setRecentSearches] =
    useState(() => {
      const recent =
        localStorage.getItem("recentSearches");

      return recent ? JSON.parse(recent) : [];
    });

  const getUserLocation = () => {
    setSearchError("");

    if (!navigator.geolocation) {
      setSearchError(
        "Geolocation is not supported by your browser."
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        setUserPosition(location);
        setSelectedLocation(null);
        setRouteCoordinates([]);
        setRouteInfo(null);
        setRouteError("");
      },
      (error) => {
        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          setSearchError(
            "Location permission was denied."
          );
        } else if (
          error.code ===
          error.POSITION_UNAVAILABLE
        ) {
          setSearchError(
            "Your location is unavailable."
          );
        } else if (
          error.code === error.TIMEOUT
        ) {
          setSearchError(
            "Location request timed out."
          );
        } else {
          setSearchError(
            "Unable to get your location."
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSearch = async (event) => {
    event.preventDefault();

    if (!searchQuery.trim()) {
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setSearchResults([]);

    try {
      const results =
        await searchPlaces(searchQuery);

      if (results.length === 0) {
        setSearchError("No locations found.");
      } else {
        setSearchResults(results);
      }
    } catch (error) {
      setSearchError(
        "Unable to search right now."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const addToRecentSearches = (result) => {
    const recentItem = {
      id: result.id,
      name: result.name,
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      address: result.address || {},
    };

    const updatedRecent = [
      recentItem,
      ...recentSearches.filter(
        (item) => item.id !== result.id
      ),
    ].slice(0, 5);

    setRecentSearches(updatedRecent);

    localStorage.setItem(
      "recentSearches",
      JSON.stringify(updatedRecent)
    );
  };

  const handleSelectLocation = (result) => {
    const position = [
      Number(result.latitude),
      Number(result.longitude),
    ];

    setSelectedLocation({
      position,
      name: result.name,
      address: result.address || {},
    });

    setSearchResults([]);
    setSearchQuery(result.name);
    setSearchError("");

    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteError("");

    addToRecentSearches(result);
  };

  const selectRecentLocation = (location) => {
    const position = [
      Number(location.latitude),
      Number(location.longitude),
    ];

    setSelectedLocation({
      position,
      name: location.name,
      address: location.address || {},
    });

    setSearchQuery(location.name);
    setSearchResults([]);
    setSearchError("");

    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteError("");
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(
      "recentSearches"
    );
  };

  useEffect(() => {
    if (!userPosition || !selectedLocation) {
      return;
    }

    let cancelled = false;

    const loadRoute = async () => {
      setRouteLoading(true);
      setRouteError("");

      try {
        const route = await getDrivingRoute(
          userPosition,
          selectedLocation.position
        );

        if (!cancelled) {
          setRouteCoordinates(
            route.coordinates
          );

          setRouteInfo({
            distance: route.distance,
            duration: route.duration,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setRouteError(
            "Unable to calculate the route."
          );

          setRouteCoordinates([]);
          setRouteInfo(null);
        }
      } finally {
        if (!cancelled) {
          setRouteLoading(false);
        }
      }
    };

    loadRoute();

    return () => {
      cancelled = true;
    };
  }, [userPosition, selectedLocation]);

  const saveLocation = () => {
    if (!selectedLocation) {
      return;
    }

    const alreadySaved =
      savedLocations.some(
        (location) =>
          Number(location.latitude) ===
            selectedLocation.position[0] &&
          Number(location.longitude) ===
            selectedLocation.position[1]
      );

    if (alreadySaved) {
      return;
    }

    const newLocation = {
      id: Date.now(),
      name: selectedLocation.name,
      latitude:
        selectedLocation.position[0],
      longitude:
        selectedLocation.position[1],
      address:
        selectedLocation.address || {},
    };

    const updatedLocations = [
      ...savedLocations,
      newLocation,
    ];

    setSavedLocations(updatedLocations);

    localStorage.setItem(
      "savedLocations",
      JSON.stringify(updatedLocations)
    );
  };

  const selectSavedLocation = (location) => {
    const position = [
      Number(location.latitude),
      Number(location.longitude),
    ];

    setSelectedLocation({
      position,
      name: location.name,
      address: location.address || {},
    });

    setSearchQuery(location.name);
    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteError("");
  };

  const deleteSavedLocation = (id) => {
    const updatedLocations =
      savedLocations.filter(
        (location) =>
          location.id !== id
      );

    setSavedLocations(updatedLocations);

    localStorage.setItem(
      "savedLocations",
      JSON.stringify(updatedLocations)
    );
  };

  const clearRoute = () => {
    setSelectedLocation(null);
    setRouteCoordinates([]);
    setRouteInfo(null);
    setRouteError("");
    setSearchResults([]);
  };

  const isCurrentLocationSaved =
    selectedLocation &&
    savedLocations.some(
      (location) =>
        Number(location.latitude) ===
          selectedLocation.position[0] &&
        Number(location.longitude) ===
          selectedLocation.position[1]
    );

  const mapPosition =
    selectedLocation?.position ||
    userPosition;

  const address =
    selectedLocation?.address || {};

  return (
    <div className="map-view">

      {/* SIDEBAR */}

      <aside className="map-sidebar">

        <div className="sidebar-title">
          <small>MAP EXPLORER</small>
          <h2>Find a location</h2>
        </div>

        {/* SEARCH */}

        <form
          className="search-form"
          onSubmit={handleSearch}
        >
          <input
            className="search-input"
            type="text"
            placeholder="Search places..."
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
          />

          <button
            className="search-button"
            type="submit"
            disabled={isSearching}
          >
            {isSearching
              ? "..."
              : "Search"}
          </button>
        </form>

        {/* QUICK ACTIONS */}

        <div className="quick-actions">

          <button
            className="action-button primary"
            onClick={getUserLocation}
          >
            📍 My Location
          </button>

          <button
            className="action-button danger"
            onClick={clearRoute}
            disabled={
              !selectedLocation &&
              routeCoordinates.length === 0
            }
          >
            Clear
          </button>

        </div>

        {/* ERRORS */}

        {searchError && (
          <div className="error-message">
            {searchError}
          </div>
        )}

        {routeError && (
          <div className="error-message">
            {routeError}
          </div>
        )}

        {/* SEARCH RESULTS */}

        {searchResults.length > 0 && (
          <div className="search-results">

            {searchResults.map((result) => (
              <div
                className="search-result"
                key={result.id}
                onClick={() =>
                  handleSelectLocation(
                    result
                  )
                }
              >
                📍 {result.name}
              </div>
            ))}

          </div>
        )}

        {/* PLACE DETAILS */}

        {selectedLocation && (
          <section className="panel-card place-details">

            <div className="panel-heading">
              <strong>
                📍 Place Details
              </strong>
            </div>

            <div className="place-name">
              {selectedLocation.name}
            </div>

            <div className="detail-row">
              <span>Address</span>
              <strong>
                {address.road ||
                  address.neighbourhood ||
                  address.suburb ||
                  address.city ||
                  "Address unavailable"}
              </strong>
            </div>

            <div className="detail-row">
              <span>City</span>
              <strong>
                {address.city ||
                  address.town ||
                  address.village ||
                  "Not available"}
              </strong>
            </div>

            <div className="detail-row">
              <span>Country</span>
              <strong>
                {address.country ||
                  "Not available"}
              </strong>
            </div>

            <div className="coordinates-box">

              <div>
                <span>Latitude</span>
                <strong>
                  {selectedLocation.position[0].toFixed(
                    5
                  )}
                </strong>
              </div>

              <div>
                <span>Longitude</span>
                <strong>
                  {selectedLocation.position[1].toFixed(
                    5
                  )}
                </strong>
              </div>

            </div>

          </section>
        )}

        {/* RECENT SEARCHES */}

        <section className="panel-card">

          <div className="panel-heading">

            <strong>
              🕘 Recent Searches
            </strong>

            {recentSearches.length > 0 && (
              <button
                className="clear-button"
                onClick={
                  clearRecentSearches
                }
              >
                Clear
              </button>
            )}

          </div>

          {recentSearches.length === 0 ? (
            <div className="empty-message">
              No recent searches.
            </div>
          ) : (
            recentSearches.map(
              (location) => (
                <div
                  className="location-item"
                  key={location.id}
                  onClick={() =>
                    selectRecentLocation(
                      location
                    )
                  }
                >
                  <div className="location-name">
                    {location.name}
                  </div>
                </div>
              )
            )
          )}

        </section>

        {/* SAVED LOCATIONS */}

        <section className="panel-card">

          <div className="panel-heading">
            <strong>
              ⭐ Saved Locations
            </strong>
          </div>

          {savedLocations.length === 0 ? (
            <div className="empty-message">
              No saved locations yet.
            </div>
          ) : (
            savedLocations.map(
              (location) => (
                <div
                  className="location-item"
                  key={location.id}
                >

                  <div
                    className="location-name"
                    onClick={() =>
                      selectSavedLocation(
                        location
                      )
                    }
                  >
                    {location.name}
                  </div>

                  <button
                    className="remove-button"
                    onClick={() =>
                      deleteSavedLocation(
                        location.id
                      )
                    }
                  >
                    Remove
                  </button>

                </div>
              )
            )
          )}

        </section>

      </aside>

      {/* MAP */}

      <MapContainer
        center={defaultPosition}
        zoom={13}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        style={{
          height: "100%",
          width: "100%",
        }}
      >

        <LayersControl
          position="topright"
        >

          <LayersControl.BaseLayer
            checked
            name="Street Map"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer
            name="Topographic Map"
          >
            <TileLayer
              attribution="&copy; OpenTopoMap contributors"
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

        </LayersControl>

        {/* CURRENT LOCATION */}

        {userPosition && (
          <Marker
            position={userPosition}
          >
            <Popup>

              <strong>
                Your Current Location
              </strong>

              <br />

              Latitude:{" "}
              {userPosition[0].toFixed(
                5
              )}

              <br />

              Longitude:{" "}
              {userPosition[1].toFixed(
                5
              )}

            </Popup>
          </Marker>
        )}

        {/* DESTINATION */}

        {selectedLocation && (
          <Marker
            position={
              selectedLocation.position
            }
          >
            <Popup>

              <strong>
                {selectedLocation.name}
              </strong>

              <br />

              {address.city ||
                address.town ||
                address.village ||
                ""}

            </Popup>
          </Marker>
        )}

        {/* ROUTE */}

        {routeCoordinates.length > 0 && (
          <Polyline
            positions={
              routeCoordinates
            }
            pathOptions={{
              color: "#2563eb",
              weight: 6,
              opacity: 0.8,
            }}
          />
        )}

        {!routeCoordinates.length &&
          mapPosition && (
            <LocationController
              position={mapPosition}
            />
          )}

        {routeCoordinates.length > 0 && (
          <RouteController
            coordinates={
              routeCoordinates
            }
          />
        )}

      </MapContainer>

      {/* ROUTE LOADING */}

      {routeLoading && (
        <div className="loading-card">
          🚗 Calculating route...
        </div>
      )}

      {/* ROUTE INFORMATION */}

      {routeInfo &&
        !routeLoading && (
          <div className="route-card">

            <div className="route-title">
              🚗 Driving Route
            </div>

            <div className="route-details">

              <div className="route-detail">
                <span>Distance</span>

                <strong>
                  {(
                    routeInfo.distance /
                    1000
                  ).toFixed(1)}{" "}
                  km
                </strong>
              </div>

              <div className="route-detail">
                <span>
                  Estimated time
                </span>

                <strong>
                  {formatDuration(
                    routeInfo.duration
                  )}
                </strong>
              </div>

            </div>

          </div>
        )}

      {/* SAVE LOCATION */}

      {selectedLocation && (
        <button
          className={`save-button ${
            isCurrentLocationSaved
              ? "saved"
              : ""
          }`}
          onClick={saveLocation}
          disabled={
            isCurrentLocationSaved
          }
        >
          {isCurrentLocationSaved
            ? "✓ Saved"
            : "⭐ Save Location"}
        </button>
      )}

    </div>
  );
}

export default MapView;