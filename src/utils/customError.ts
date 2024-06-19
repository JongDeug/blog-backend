export class CustomError extends Error {
    public status: number;
    public statusDescription: string;

    constructor(status: number, message: string, statusDescription: string) {
        super(message);
        this.status = status;
        this.statusDescription = statusDescription;
    }
}
