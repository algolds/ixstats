import { api } from "~/trpc/react";

/** One tRPC mutation per create / update / delete procedure the map editor uses. */
export function useFeatureMutations() {
  const geo = api.geoFeatures;
  return {
    city: {
      create: geo.createCity.useMutation(),
      update: geo.updateCity.useMutation(),
      remove: geo.deleteCity.useMutation(),
    },
    subdivision: {
      create: geo.createSubdivision.useMutation(),
      update: geo.updateSubdivision.useMutation(),
      remove: geo.deleteSubdivision.useMutation(),
      /** Region attributes (colour, government type) live on countryGeo, not geoFeatures. */
      upsertAttributes: api.countryGeo.upsertSubdivision.useMutation(),
    },
    poi: {
      create: geo.createPOI.useMutation(),
      update: geo.updatePOI.useMutation(),
      remove: geo.deletePOI.useMutation(),
    },
    storyPin: {
      create: geo.createStoryPin.useMutation(),
      update: geo.updateStoryPin.useMutation(),
      remove: geo.deleteStoryPin.useMutation(),
    },
    mapLabel: {
      create: geo.createMapLabel.useMutation(),
      update: geo.updateMapLabel.useMutation(),
      remove: geo.deleteMapLabel.useMutation(),
    },
    peak: {
      create: geo.createPeak.useMutation(),
      update: geo.updatePeak.useMutation(),
      remove: geo.deletePeak.useMutation(),
    },
    river: {
      create: geo.createNamedRiver.useMutation(),
      update: geo.updateNamedRiver.useMutation(),
      remove: geo.deleteNamedRiver.useMutation(),
    },
    lake: {
      create: geo.createNamedLake.useMutation(),
      update: geo.updateNamedLake.useMutation(),
      remove: geo.deleteNamedLake.useMutation(),
    },
    route: {
      create: api.transport.createRoute.useMutation(),
      update: api.transport.updateRoute.useMutation(),
      updateGeometry: api.transport.updateRouteGeometry.useMutation(),
      remove: api.transport.deleteRoute.useMutation(),
    },
  };
}

export type FeatureMutations = ReturnType<typeof useFeatureMutations>;
