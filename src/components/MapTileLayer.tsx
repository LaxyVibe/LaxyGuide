import { useEffect } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import { resolveBundledTileUrl, type ResolvedMapTileBundle } from '../utils/mapTileBundle';

const EMPTY_TILE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';

interface MapTileLayerProps {
    mapTileUrlTemplate?: string;
    mapTileBundle?: ResolvedMapTileBundle;
    bounds: L.LatLngBounds;
    mapTileMaxZoom: number;
    mapMinZoom: number;
    mapMaxZoom: number;
}

const BundledTileLayer: React.FC<MapTileLayerProps> = ({
    mapTileBundle,
    bounds,
    mapTileMaxZoom,
    mapMinZoom,
    mapMaxZoom
}) => {
    const map = useMap();

    useEffect(() => {
        if (!mapTileBundle) return;

        const layer = new L.TileLayer('', {
            noWrap: true,
            bounds,
            maxNativeZoom: mapTileMaxZoom,
            maxZoom: mapMaxZoom,
            minZoom: mapMinZoom,
            keepBuffer: 2,
            errorTileUrl: EMPTY_TILE_DATA_URL
        });

        layer.getTileUrl = (coords: L.Coords) => {
            return resolveBundledTileUrl(mapTileBundle, coords.z, coords.x, coords.y) || EMPTY_TILE_DATA_URL;
        };

        layer.addTo(map);
        return () => {
            map.removeLayer(layer);
        };
    }, [bounds, map, mapMaxZoom, mapMinZoom, mapTileBundle, mapTileMaxZoom]);

    return null;
};

const MapTileLayer: React.FC<MapTileLayerProps> = ({
    mapTileUrlTemplate,
    mapTileBundle,
    bounds,
    mapTileMaxZoom,
    mapMinZoom,
    mapMaxZoom
}) => {
    if (mapTileBundle) {
        return (
            <BundledTileLayer
                mapTileBundle={mapTileBundle}
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
