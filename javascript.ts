/**
 * Preset Architecture Definition
 */
export interface DocumentRequirement {
    width: number;
    height: number;
    minKb: number;
    maxKb: number;
    format: 'image/jpeg' | 'image/png';
}

export interface GovernmentService {
    label: string;
    photo: DocumentRequirement;
    signature: DocumentRequirement;
}

export const GOVT_PRESETS: Record<string, GovernmentService> = {
    ssc: {
        label: "SSC (CGL, CHSL, MTS)",
        photo: { width: 413, height: 531, minKb: 20, maxKb: 50, format: 'image/jpeg' },
        signature: { width: 472, height: 118, minKb: 10, maxKb: 20, format: 'image/jpeg' }
    },
    upsc: {
        label: "UPSC Civil Services",
        photo: { width: 350, height: 350, minKb: 20, maxKb: 300, format: 'image/jpeg' },
        signature: { width: 350, height: 350, minKb: 20, maxKb: 300, format: 'image/jpeg' }
    },
    railway: {
        label: "Railway (RRB/RRC)",
        photo: { width: 320, height: 240, minKb: 20, maxKb: 50, format: 'image/jpeg' },
        signature: { width: 140, height: 60, minKb: 10, maxKb: 40, format: 'image/jpeg' }
    },
    aadhaar: {
        label: "Aadhaar Card Update",
        photo: { width: 400, height: 400, minKb: 10, maxKb: 50, format: 'image/jpeg' },
        signature: { width: 400, height: 100, minKb: 10, maxKb: 50, format: 'image/jpeg' }
    },
    passport: {
        label: "Indian Passport Size",
        photo: { width: 413, height: 531, minKb: 10, maxKb: 100, format: 'image/jpeg' },
        signature: { width: 700, height: 200, minKb: 10, maxKb: 100, format: 'image/jpeg' }
    }
};
