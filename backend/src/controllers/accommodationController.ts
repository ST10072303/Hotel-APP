import type { Request, Response } from "express";
import { z } from "zod";
import { getAccommodationById, getAllAccommodations } from "../services/accommodationService.js";

// Validate filters received through the URL query string.

const accommodationFiltersSchema = z.object({
    city: z.string().trim().min(1).max(100).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    minPrice: z.coerce.number().finite().min(0).optional(),
    maxPrice: z.coerce.number().finite().min(0).optional(),
    minRating: z.coerce.number().finite().min(1).max(5).optional(),

    // Pagination: positive page number, maximum 100 results per page.
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),

    sortBy: z.enum(["name", "minimum_price", "star_rating"])
        .default("name"),

    sortOrder: z.enum(["asc", "desc"])
        .default("asc"),

})
    .strict()
    .refine(
        (filters) => filters.minPrice === undefined || filters.maxPrice === undefined || filters.minPrice <= filters.maxPrice,
        {message: "minPrice cannot be greater than maxPrice"}
    );

// GET /api/accommodations
// List accommodations with optional filters and pagination.
export const getAccommodations = async (req: Request, res: Response): Promise<void> => {
    const validation = accommodationFiltersSchema.safeParse(req.query);

    if (!validation.success) {
        res.status(400).json({success: false, message: "Invalid accommodation filters",
            errors: validation.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))});
        return;
    }

    const result = await getAllAccommodations(validation.data);

    res.status(200).json({success: true, count: result.data.length, data: result.data,
        pagination: {total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages}});
};

// GET /api/accommodations/:id
// Return one accommodation by its ID.
export const getAccommodationDetails = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id;

    // Ensure the route parameter is a single string.
    if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
        res.status(400).json({ success: false, message: "Accommodation ID must be a positive integer" });
        return;
    }

    const accommodation = await getAccommodationById(id);
    // Return 404 when the accommodation does not exist or is inactive.
    if (!accommodation) {
        res.status(404).json({ success: false, message: "Accommodation not found" });
        return;
    }
    res.status(200).json({ success: true, data: accommodation });
};