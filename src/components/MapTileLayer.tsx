import { useEffect } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import {
    resolveBundledLabelTileUrl,
    resolveBundledTileUrl,
    type ResolvedMapTileBundle
} from '../utils/mapTileBundle';

const EMPTY_TILE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

interface MapTileLayerProps {
    mapTileUrlTemplate?: string;
    mapTileBundle?: ResolvedMapTileBundle;
    mapLanguage?: string;
    bounds: L.LatLngBounds;
    mapTileMaxZoom: number;
    mapMinZoom: number;
    mapMaxZoom: number;
}

const BundledTileLayer: React.FC<MapTileLayerProps> = ({
    mapTileBundle,
    mapLanguage,
    bounds,
    mapTileMaxZoom,
    mapMinZoom,
    mapMaxZoom
}) => {
    const map = useMap();

    useEffect(() => {
        if (!mapTileBundle) return;

        const baseLayer = new L.TileLayer('', {
            noWrap: true,
            bounds,
            maxNativeZoom: mapTileMaxZoom,
            maxZoom: mapMaxZoom,
            minZoom: mapMinZoom,
            keepBuffer: 2,
            zIndex: 100,
            errorTileUrl: EMPTY_TILE_DATA_URL
        });

        baseLayer.getTileUrl = (coords: L.Coords) => {
            return resolveBundledTileUrl(mapTileBundle, coords.z, coords.x, coords.y) || EMPTY_TILE_DATA_URL;
        };

        baseLayer.addTo(map);

        let labelLayer: L.TileLayer | null = null;
        const hasLabelLayer = mapLanguage && Object.keys(
            mapTileBundle.manifest.labelTilePathTemplates ?? {}
        ).some((language) => language.toLowerCase() === mapLanguage.toLowerCase());
        if (mapLanguage && hasLabelLayer) {
            labelLayer = new L.TileLayer('', {
                noWrap: true,
                bounds,
                maxNativeZoom: mapTileMaxZoom,
                maxZoom: mapMaxZoom,
                minZoom: mapMinZoom,
                keepBuffer: 2,
                zIndex: 200,
                errorTileUrl: EMPTY_TILE_DATA_URL
            });
            labelLayer.getTileUrl = (coords: L.Coords) => {
                return resolveBundledLabelTileUrl(
                    mapTileBundle,
                    mapLanguage,
                    coords.z,
                    coords.x,
                    coords.y
                ) || EMPTY_TILE_DATA_URL;
            };
            labelLayer.addTo(map);
        }

        return () => {
            map.removeLayer(baseLayer);
            if (labelLayer) map.removeLayer(labelLayer);
        };
    }, [bounds, map, mapLanguage, mapMaxZoom, mapMinZoom, mapTileBundle, mapTileMaxZoom]);

    return null;
};

const MapTileLayer: React.FC<MapTileLayerProps> = ({
    mapTileUrlTemplate,
    mapTileBundle,
    mapLanguage,
    bounds,
    mapTileMaxZoom,
    mapMinZoom,
    mapMaxZoom
}) => {
    if (mapTileBundle) {
        return (
            <BundledTileLayer
                mapTileBundle={mapTileBundle}
                mapLanguage={mapLanguage}
                bounds={bounds}
                mapTileMaxZoom={mapTileMaxZoom}
                mapMinZoom={mapMinZoom}
                mapMaxZoom={mapMaxZoom}
            />
        );
    }

    if (!mapTileUrlTemplate) return null;

    return (
        <TileLayer
            url={mapTileUrlTemplate}
            noWrap={true}
            bounds={bounds}
            maxNativeZoom={mapTileMaxZoom}
            maxZoom={mapMaxZoom}
            minZoom={mapMinZoom}
            keepBuffer={2}
            errorTileUrl=""
        />
    );
};

export default MapTileLayer;
