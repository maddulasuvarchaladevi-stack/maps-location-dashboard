 const NOMINATIM_URL =
  "https://nominatim.openstreetmap.org/search";

const OSRM_URL =
  "https://router.project-osrm.org/route/v1/driving";

export async function searchPlaces(
  query,
  latitude,
  longitude
) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  const viewbox = [
    lon - 1.5,
    lat + 1.5,
    lon + 1.5,
    lat - 1.5,
  ].join(",");

  const params = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "10",
    countrycodes: "in",
    viewbox,
    bounded: "0",
  });

  const response = await fetch(
    `${NOMINATIM_URL}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Unable to search places.");
  }

  const data = await response.json();

  return data
    .map((place) => ({
      id: place.place_id,
      name:
        place.name ||
        place.display_name.split(",")[0],
      displayName: place.display_name,
      latitude: Number(place.lat),
      longitude: Number(place.lon),
      type: place.type,
    }))
    .sort((a, b) => {
      const distanceA =
        Math.pow(a.latitude - lat, 2) +
        Math.pow(a.longitude - lon, 2);

      const distanceB =
        Math.pow(b.latitude - lat, 2) +
        Math.pow(b.longitude - lon, 2);

      return distanceA - distanceB;
    });
}

async function requestRoute(coordinates) {
  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "true",
  });

  const response = await fetch(
    `${OSRM_URL}/${coordinates}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Route request failed.");
  }

  const data = await response.json();

  if (
    data.code !== "Ok" ||
    !data.routes ||
    data.routes.length === 0
  ) {
    return null;
  }

  return data.routes[0];
}

export async function getDrivingRoutes(
  start,
  destination
) {
  const startLat = Number(start[0]);
  const startLon = Number(start[1]);

  const endLat = Number(destination[0]);
  const endLon = Number(destination[1]);

  /*
   * First request the normal OSRM route.
   * This is the actual shortest/fastest candidate
   * returned by the routing engine.
   */
  const directCoordinates =
    `${startLon},${startLat};${endLon},${endLat}`;

  const primaryRoute =
    await requestRoute(directCoordinates);

  if (!primaryRoute) {
    throw new Error(
      "No driving route was found."
    );
  }

  const candidates = [
    {
      id: 1,
      type: "primary",
      route: primaryRoute,
    },
  ];

  /*
   * Try several nearby intermediate points.
   *
   * These requests ask the routing engine to use
   * different parts of the road network.
   *
   * They are alternatives/candidates, not claims
   * that every one is shorter than Route 1.
   */
  const midLat =
    (startLat + endLat) / 2;

  const midLon =
    (startLon + endLon) / 2;

  const latDifference =
    Math.abs(endLat - startLat);

  const lonDifference =
    Math.abs(endLon - startLon);

  const offset =
    Math.max(
      Math.min(
        Math.max(
          latDifference,
          lonDifference
        ) * 0.35,
        0.08
      ),
      0.015
    );

  const waypointCandidates = [
    [
      midLat + offset,
      midLon,
    ],
    [
      midLat - offset,
      midLon,
    ],
    [
      midLat,
      midLon + offset,
    ],
    [
      midLat,
      midLon - offset,
    ],
  ];

  for (
    const waypoint of waypointCandidates
  ) {
    if (candidates.length >= 3) {
      break;
    }

    const waypointLat = waypoint[0];
    const waypointLon = waypoint[1];

    const coordinates =
      `${startLon},${startLat};` +
      `${waypointLon},${waypointLat};` +
      `${endLon},${endLat}`;

    try {
      const route =
        await requestRoute(coordinates);

      if (!route) {
        continue;
      }

      const alreadyExists =
        candidates.some((candidate) => {
          const difference =
            Math.abs(
              candidate.route.distance -
                route.distance
            );

          return (
            difference <
            Math.max(
              300,
              candidate.route.distance * 0.05
            )
          );
        });

      if (!alreadyExists) {
        candidates.push({
          id: candidates.length + 1,
          type: "alternative",
          route,
        });
      }
    } catch {
      // Ignore an unavailable waypoint.
    }
  }

  /*
   * Convert routes into the format used by
   * the React UI.
   */
  return candidates.map(
    (candidate) => ({
      id: candidate.id,
      type: candidate.type,
      distance:
        candidate.route.distance,
      duration:
        candidate.route.duration,
      geometry:
        candidate.route.geometry,
      legs:
        candidate.route.legs,
    })
  );
}

export function formatDistance(
  meters
) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }

  return `${(
    meters / 1000
  ).toFixed(1)} km`;
}

export function formatDuration(
  seconds
) {
  const totalMinutes =
    Math.round(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours =
    Math.floor(totalMinutes / 60);

  const minutes =
    totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${minutes} min`;
}