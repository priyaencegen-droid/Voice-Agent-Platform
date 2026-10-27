import API from "./api";

export const getVoices = async (params = {}) => {
    const response = await API.get("/voices", { params });
    return response.data;
};

export const getVoicePreview = async ({ voiceId, text, voiceSpeed, signal }) => {
    const response = await API.post(
        "/voices/preview",
        {
            voice_id: voiceId,
            text,
            voice_speed: voiceSpeed,
        },
        { responseType: "blob", signal }
    );
    return response.data;
};