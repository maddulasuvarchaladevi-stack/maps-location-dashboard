 export async function searchPlaces(query) {
  if (!query.trim()) {
    return [];
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    query
  )}&limit=5&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Search request failed.");
  }

  const data = await response.json();

  return data.map((place) => ({
    id: place.place_id,
    name: place.display_name,
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    address: place.address || {},
  }));
}

export async function getDrivingRoute(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Route request failed.");
  }

  const data = await response.json();

  if (
    data.code !== "Ok" ||
    !data.routes ||
    data.routes.length === 0
  ) {
    throw new Error("No route found.");
  }

  const route = data.routes[0];

  return {
    coordinates: route.geometry.coordinates.map(
      ([longitude, latitude]) => [
        latitude,
        longitude,
      ]
    ),
    distance: route.distance,
    duration: route.duration,
  };
}