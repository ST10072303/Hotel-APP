export interface AuthUser {
    id: string;
    full_name: string;
    email: string;
    role: "customer" | "admin";
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data: {
        user: AuthUser;
        token: string;
    };
}

export interface AuthErrorResponse {
    success: false;
    message: string;
    errors?: {
        field: string; message: string;
    }[];
}
