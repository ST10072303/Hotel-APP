import { pool } from "../config/database.js";

export interface Accommodation {
    id: string;
    name: string;
    description: string | null;
    address: string;
    city: string;
    country: string;
    star_rating: string | null;
    minimum_price: string | null;
    image_url: string | null;
}

export interface AccommodationFilters {
    city?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    page?: number;
    limit?: number;
    sortBy?: "name" | "minimum_price" | "star_rating";
    sortOrder?: "asc" | "desc";
}

export interface PaginatedAccommodations {
    data: Accommodation[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface RoomType {
    id: string;
    name: string;
    description: string | null;
    capacity: number;
    price_per_night: string;
    total_units: number;
}

export interface AccommodationImage {
    id: string;
    image_url: string;
    alt_text: string | null;
    display_order: number;
}

export interface Amenity {
    id: string;
    name: string;
    description: string | null;
}

export interface AccommodationPolicy {
    id: string;
    policy_type: string;
    title: string;
    description: string;
}

export interface AccommodationDetails extends Accommodation {
    room_types: RoomType[];
    images: AccommodationImage[];
    amenities: Amenity[];
    policies: AccommodationPolicy[];
}

// Retrieve all active accommodations, optionally filtered by city, search term, and price range.

export const getAllAccommodations = async (
    filters: AccommodationFilters = {}
): Promise<PaginatedAccommodations> => {
    // Default to page 1 and 10 accommodations per page.
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;

    // Calculate how many records to skip.
    const offset = (page - 1) * limit;

    // Default to sorting accommodation names from A to Z.
    const sortBy = filters.sortBy ?? "name";
    const sortOrder = filters.sortOrder ?? "asc";

    const conditions: string[] = ["a.is_active = TRUE"];
    const values: (string | number)[] = [];

    // Add a condition only when the user supplies that filter.
    if (filters.city) {
        values.push(filters.city);
        conditions.push(`LOWER(a.city) = LOWER($${values.length})`);
    }

    if (filters.search) {
        values.push(`%${filters.search}%`);
        conditions.push(`(a.name ILIKE $${values.length} OR a.city ILIKE $${values.length})`);
    }

    if (filters.minRating !== undefined) {
        values.push(filters.minRating);
        conditions.push(`a.star_rating >= $${values.length}`);
    }

    // Apply both price boundaries to the same active room type.
    if (
        filters.minPrice !== undefined ||
        filters.maxPrice !== undefined
    ) {
        const priceConditions: string[] = ["rt_price.accommodation_id = a.id", "rt_price.is_active = TRUE"];

        if (filters.minPrice !== undefined) {
            values.push(filters.minPrice);
            priceConditions.push(`rt_price.price_per_night >= $${values.length}`);
        }

        if (filters.maxPrice !== undefined) {
            values.push(filters.maxPrice);
            priceConditions.push(`rt_price.price_per_night <= $${values.length}`);
        }

        conditions.push(`EXISTS (SELECT 1
        FROM room_types rt_price
        WHERE ${priceConditions.join(" AND ")})`
        );
    }

    // Allow only predefined sorting expressions.
    const sortColumns = {
        name: "a.name",
        minimum_price: "MIN(rt.price_per_night)",
        star_rating: "a.star_rating",
    } as const;

    const sortColumn = sortColumns[sortBy];
    // The sort direction is restricted to ASC or DESC.
    const sortDirection = sortOrder === "desc" ? "DESC" : "ASC";

    const query = `SELECT a.id, a.name, a.description, a.address, a.city, a.country, a.star_rating,
      MIN(rt.price_per_night) AS minimum_price,
      (
        SELECT ai.image_url
        FROM accommodation_images ai
        WHERE ai.accommodation_id = a.id
        ORDER BY ai.display_order, ai.id
        LIMIT 1
      ) AS image_url
    FROM accommodations a
    LEFT JOIN room_types rt
      ON rt.accommodation_id = a.id
      AND rt.is_active = TRUE
    WHERE ${conditions.join(" AND ")}
    GROUP BY a.id
    ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, a.id ASC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2};
  `;

    // Count all matching active accommodations before pagination.
    const countQuery = `
    SELECT COUNT(*) AS total
    FROM accommodations a
    WHERE ${conditions.join(" AND ")};
  `;

    const countResult = await pool.query<{ total: string }>(
        countQuery,
        values
    );

    const total = Number(countResult.rows[0].total);

    // Add pagination values after the existing filter values.
    const paginationValues = [...values, limit, offset];
    const result = await pool.query<Accommodation>(query, paginationValues);


    return {
        data: result.rows, total, page, limit,
        totalPages: Math.ceil(total / limit)
    };

};

// Retrieve a single accommodation by its ID, including the minimum price and first image.
export const getAccommodationById = async (
    id: string
): Promise<AccommodationDetails | null> => {
    // Fetch the main accommodation details and minimum nightly price.
    const accommodationQuery = `
    SELECT
      a.id,
      a.name,
      a.description,
      a.address,
      a.city,
      a.country,
      a.star_rating,
      MIN(rt.price_per_night) AS minimum_price,
      (
        SELECT ai.image_url
        FROM accommodation_images ai
        WHERE ai.accommodation_id = a.id
        ORDER BY ai.display_order, ai.id
        LIMIT 1
      ) AS image_url
    FROM accommodations a
    LEFT JOIN room_types rt
      ON rt.accommodation_id = a.id
      AND rt.is_active = TRUE
    WHERE a.id = $1
      AND a.is_active = TRUE
    GROUP BY a.id;
  `;

    const accommodationResult = await pool.query<Accommodation>(
        accommodationQuery,
        [id]
    );

    const accommodation = accommodationResult.rows[0];

    // Return null if the accommodation does not exist or is inactive.
    if (!accommodation) {
        return null;
    }

    // Fetch active room types.
    const roomTypesQuery = `
    SELECT
      id,
      name,
      description,
      capacity,
      price_per_night,
      total_units
    FROM room_types
    WHERE accommodation_id = $1
      AND is_active = TRUE
    ORDER BY price_per_night ASC;
  `;

    // Fetch all images in display order.
    const imagesQuery = `
    SELECT
      id,
      image_url,
      alt_text,
      display_order
    FROM accommodation_images
    WHERE accommodation_id = $1
    ORDER BY display_order ASC, id ASC;
  `;

    // Fetch the accommodation's amenities.
    const amenitiesQuery = `
    SELECT
      am.id,
      am.name,
      am.description
    FROM amenities am
    INNER JOIN accommodation_amenities aa
      ON aa.amenity_id = am.id
    WHERE aa.accommodation_id = $1
    ORDER BY am.name ASC;
  `;

    // Fetch the accommodation's policies.
    const policiesQuery = `
    SELECT
      id,
      policy_type,
      title,
      description
    FROM accommodation_policies
    WHERE accommodation_id = $1
    ORDER BY policy_type ASC, id ASC;
  `;

    // Run the independent queries simultaneously.
    const [
        roomTypesResult,
        imagesResult,
        amenitiesResult,
        policiesResult,
    ] = await Promise.all([
        pool.query(roomTypesQuery, [id]),
        pool.query(imagesQuery, [id]),
        pool.query(amenitiesQuery, [id]),
        pool.query(policiesQuery, [id]),
    ]);

    // Return one combined object for the hotel details page.
    return {
        ...accommodation,
        room_types: roomTypesResult.rows,
        images: imagesResult.rows,
        amenities: amenitiesResult.rows,
        policies: policiesResult.rows,
    };
};


