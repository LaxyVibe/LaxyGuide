export function resolveResetViewTarget<TPoint>(params: {
    currentLocationPoint?: TPoint | null;
    fallbackPoint: TPoint;
    resetLevel: number;
}) {
    return {
        point: params.currentLocationPoint ?? params.fallbackPoint,
        level: params.resetLevel
    };
}
