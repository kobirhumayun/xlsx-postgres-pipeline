/**
 * Safely fetches JSON from an API endpoint.
 * Throws an error if the response is not OK or if the content is not JSON.
 *
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} [options] - Fetch options.
 * @returns {Promise<any>} - The parsed JSON response.
 */
export async function fetchJson(url, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    if (options.body instanceof FormData) {
        delete headers["Content-Type"];
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");

    // If response is OK but not JSON, we can't parse it.
    if (response.ok && !isJson) {
        // Some endpoints might return empty body for 204 No Content
        if (response.status === 204) return null;

        throw new Error(`API returned ${contentType} but expected JSON.`);
    }

    // If not OK, try to parse error message from JSON, otherwise fallback to status text
    if (!response.ok) {
        let errorPayload = null;
        try {
            errorPayload = await response.clone().json();
        } catch (parseError) {
            errorPayload = null;
        }

        if (errorPayload) {
            const error = new Error(
                errorPayload.error || errorPayload.message || "An error occurred"
            );
            error.payload = errorPayload;
            throw error;
        }

        // If not JSON (e.g. HTML 404/500 page), use status text
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
