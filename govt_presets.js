/**
 * Centralized Government Presets - GovDocs Pro
 * The single source of truth for all document dimensions and size limits.
 */

export const GOVT_PRESETS = {
    ssc: {
        label: "SSC (Staff Selection Commission)",
        photo: { width: 413, height: 531, minKb: 20, maxKb: 50 },
        signature: { width: 472, height: 236, minKb: 10, maxKb: 20 }
    },
    upsc: {
        label: "UPSC",
        photo: { width: 350, height: 350, minKb: 20, maxKb: 300 },
        signature: { width: 350, height: 350, minKb: 20, maxKb: 300 }
    },
    railway: {
        label: "Railway Recruitment Board",
        photo: { width: 413, height: 531, minKb: 20, maxKb: 70 },
        signature: { width: 413, height: 177, minKb: 10, maxKb: 30 }
    },
    gpsc: {
        label: "GPSC (Gujarat Public Service)",
        photo: { width: 413, height: 531, minKb: 5, maxKb: 200 },
        signature: { width: 413, height: 236, minKb: 5, maxKb: 200 }
    },
    police: {
        label: "Gujarat Police (LRB)",
        photo: { width: 413, height: 531, minKb: 10, maxKb: 50 },
        signature: { width: 413, height: 177, minKb: 5, maxKb: 20 }
    },
    passport: {
        label: "Indian Passport Size",
        photo: { width: 413, height: 531, minKb: 10, maxKb: 50 },
        signature: { width: 413, height: 177, minKb: 10, maxKb: 50 }
    },
    aadhaar: {
        label: "Aadhaar Card Update",
        photo: { width: 413, height: 531, minKb: 10, maxKb: 50 },
        signature: { width: 413, height: 177, minKb: 10, maxKb: 50 }
    }
};

export default GOVT_PRESETS;