const express = require("express");

const router = express.Router();

const paymentController =
    require("../../controllers/v1/paymentController");

const {
    requireAdmin
} = require("../../middleware/requireAdminAuth");

console.log("========================================");
console.log("💳 PAYMENT ROUTES LOADING");
console.log("========================================");

console.log(
    "createPayment:",
    typeof paymentController.createPayment
);

console.log(
    "getMyPayment:",
    typeof paymentController.getMyPayment
);

console.log(
    "getPayments:",
    typeof paymentController.getPayments
);

console.log(
    "markPaymentAsPaid:",
    typeof paymentController.markPaymentAsPaid
);

console.log(
    "rejectPayment:",
    typeof paymentController.rejectPayment
);

if (
    typeof paymentController.createPayment !== "function" ||
    typeof paymentController.getMyPayment !== "function" ||
    typeof paymentController.getPayments !== "function" ||
    typeof paymentController.markPaymentAsPaid !== "function" ||
    typeof paymentController.rejectPayment !== "function"
) {
    throw new Error(
        "❌ Payment controller is incomplete."
    );
}

// --------------------------------------------------------
// SINGER-FACING - NO ADMIN AUTH REQUIRED
// --------------------------------------------------------

router.get(
    "/my",
    paymentController.getMyPayment
);

router.post(
    "/",
    paymentController.createPayment
);


// --------------------------------------------------------
// ADMIN-ONLY
// --------------------------------------------------------

router.get(
    "/",
    requireAdmin,
    paymentController.getPayments
);

router.put(
    "/:id/mark-paid",
    requireAdmin,
    paymentController.markPaymentAsPaid
);

router.put(
    "/:id/reject",
    requireAdmin,
    paymentController.rejectPayment
);

router.put(
    "/bulk-status",
    requireAdmin,
    paymentController.bulkUpdatePaymentStatus
);

router.put(
    "/reassign-song",
    requireAdmin,
    paymentController.reassignSongToSinger
);

router.put(
    "/:id/replace-song",
    requireAdmin,
    paymentController.replaceSongInPayment
);

router.put(
    "/:id/add-song",
    requireAdmin,
    paymentController.addSongToPayment
);

router.put(
    "/:id/remove-song",
    requireAdmin,
    paymentController.removeSongFromPayment
);

console.log("✅ Payment routes loaded successfully");
console.log("GET    /api/v1/payments/my?singer_id=UUID");
console.log("GET    /api/v1/payments");
console.log("POST   /api/v1/payments");
console.log("PUT    /api/v1/payments/:id/mark-paid");
console.log("PUT    /api/v1/payments/:id/reject");
console.log("PUT    /api/v1/payments/bulk-status");
console.log("PUT    /api/v1/payments/:id/replace-song");
console.log("PUT    /api/v1/payments/:id/add-song");
console.log("PUT    /api/v1/payments/:id/remove-song");
console.log("PUT    /api/v1/payments/reassign-song");
console.log("========================================");

module.exports = router;
