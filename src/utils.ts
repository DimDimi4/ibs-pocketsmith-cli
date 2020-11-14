export function validateNonEmpty(field: string, input: string) {
    if (input) {
        return true;
    }

    return `${field} must be non empty`;
}
