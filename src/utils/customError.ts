export class CustomError extends Error {
    public status: number;
    public statusDescription: string;

    constructor(status: number, statusDescription: string, message: string) {
        super(message);
        this.status = status;
        this.statusDescription = statusDescription;
    }
}
