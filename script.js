
/* =========================================
   1. SUPABASE CONNECTION
========================================= */

const SUPABASE_URL = "https://jhlhpimabempjgyaxrwz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ngdC9veQ7ZqAxxceHCasYg_NCkQhFgY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


/* =========================================
   2. HELPER FUNCTIONS`
========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("en-IN");
}

function formatPrice(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}


/* =========================================
   3. TABLE ELEMENTS AND TAB CONFIGURATION
========================================= */

const tabs = document.querySelectorAll(".stock-tab");

const tableTitle = document.getElementById("tableTitle");
const recordCount = document.getElementById("recordCount");
const tableHeaders = document.getElementById("tableHeaders");
const tableBody = document.getElementById("tableBody");
const emptyMessage = document.getElementById("emptyMessage");

let activeTab = "sales";
let allProducts = [];

const columnConfig = {
    sales: {
    title: "Stock Items",
    headers: [
        "Product ID",
        "Product Name",
        "SKU",
        "Listing Date",
        "Category",
        "Purchase Price",
        "Sale Price",
        "Unit Quantity",
        "Unit Type"
    ]
    },

    low: {
        title: "Low Stock",
        headers: [
            "Product ID",
            "Product Name",
            "SKU",
            "Category",
            "Current Stock",
            "Minimum Stock",
            "Unit"
        ]
    },

    coming: {
        title: "Sale Product",
        headers: [
            "Sale ID",
            "Product Name",
            "SKU",
            "Customer Name",
            "Quantity",
            "Sale Price",
            "Total Amount",
            "Payment Status",
            "Payment Type",
            "Sale Date"
        ]
    }
};


/* =========================================
   4. TABLE DISPLAY FUNCTIONS
========================================= */

function showLoading() {
    if (tableBody) {
        const columnCount =
            columnConfig[activeTab]?.headers.length || 8;

        tableBody.innerHTML = `
            <tr>
                <td colspan="${columnCount}">Loading data...</td>
            </tr>
        `;
    }

    if (emptyMessage) {
        emptyMessage.textContent = "";
    }
}

function showRows(rows) {
    if (!tableBody) return;

    if (recordCount) {
        recordCount.textContent = `${rows.length} records`;
    }

    if (rows.length === 0) {
        tableBody.innerHTML = "";

        if (emptyMessage) {
            emptyMessage.textContent = "No records found.";
        }

        return;
    }

    if (emptyMessage) {
        emptyMessage.textContent = "";
    }

    tableBody.innerHTML = rows.map(function (row) {
        return `
            <tr>
                ${row.map(function (cell) {
                    return `<td>${cell ?? "—"}</td>`;
                }).join("")}
            </tr>
        `;
    }).join("");
}

function showError(message) {
    if (tableBody) {
        tableBody.innerHTML = "";
    }

    if (recordCount) {
        recordCount.textContent = "0 records";
    }

    if (emptyMessage) {
        emptyMessage.textContent = message;
    }
}

function setTableHeaders(tabName) {
    const config = columnConfig[tabName];

    if (!config) return;

    if (tableTitle) {
        tableTitle.textContent = config.title;
    }

    if (tableHeaders) {
        tableHeaders.innerHTML = config.headers.map(function (heading) {
            return `<th>${escapeHTML(heading)}</th>`;
        }).join("");
    }
}


/* =========================================
   5. LOAD ALL PRODUCTS FROM SUPABASE
========================================= */

async function fetchAllProducts() {
    const { data, error } = await supabaseClient
        .from("products")
        .select(`
            id,
            product_name,
            sku,
            category,
            purchase_price,
            selling_price,
            current_stock,
            main_stock,
            min_stock,
            unit,
            unit_type,
            unit_quantity,
            created_at
        `)
        .order("id", { ascending: true });

    if (error) {
        throw error;
    }

    allProducts = data || [];

    return allProducts;
}


/* =========================================
   6. CONVERT PRODUCT DATA INTO TABLE ROWS
========================================= */

function productToRow(product) {
    return [
        escapeHTML(product.id),
        escapeHTML(product.product_name),
        escapeHTML(product.sku || "—"),
        formatDate(product.created_at),
        escapeHTML(product.category || "—"),
        formatPrice(product.purchase_price),
        formatPrice(product.selling_price),
        escapeHTML(product.unit_quantity ?? 1),
        escapeHTML(product.unit_type || "piece")
    ];
}

function lowStockToRow(product) {
    return [
        escapeHTML(product.id),
        escapeHTML(product.product_name),
        escapeHTML(product.sku || "—"),
        escapeHTML(product.category || "—"),
        escapeHTML(product.current_stock ?? 0),
        escapeHTML(product.min_stock ?? 0),
        escapeHTML(product.unit_type || "piece")
    ];
}

function nearlyFinishedToRow(product) {
    return [
        escapeHTML(product.id),
        escapeHTML(product.product_name),
        escapeHTML(product.sku || "—"),
        escapeHTML(product.category || "—"),
        escapeHTML(product.current_stock ?? 0),
        formatPrice(product.purchase_price),
        escapeHTML(product.unit_type || "piece")
    ];
}


/* =========================================
   7. LOAD SELECTED TAB
========================================= */

async function loadTab(tabName) {
    if (!columnConfig[tabName]) return;

    activeTab = tabName;

    setTableHeaders(tabName);

    // Date filter sirf Sale Product tab par dikhe.
    const dateFilter = document.getElementById("saleDateFilter");

    if (dateFilter) {
        dateFilter.hidden = tabName !== "coming";
    }

    // Sale Product ka data alag table se load karo.
    if (tabName === "coming") {
        await loadSaleRecords();
        return;
    }

    showLoading();

    try {
        const products = await fetchAllProducts();

        let rows = [];

        if (tabName === "sales") {
            rows = products.map(productToRow);
        } else if (tabName === "low") {
            rows = products
                .filter(function (product) {
                    return (
                        Number(product.current_stock || 0) <=
                        Number(product.min_stock || 0)
                    );
                })
                .map(lowStockToRow);
        }

        showRows(rows);

    } catch (error) {
        console.error("Products loading error:", error);

        showError("Products load nahi hue: " + error.message);
    }
}


/* =========================================
   8. STOCK TAB CLICK EVENTS
========================================= */

tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
        const tabName = this.dataset.tab;

        tabs.forEach(function (item) {
            item.classList.remove("active");
        });

        this.classList.add("active");

        loadTab(tabName);
    });
});


/* =========================================
   9. GLOBAL PRODUCT SEARCH
========================================= */

const inputsearch = document.getElementById("inputsearch");

if (inputsearch) {
    inputsearch.addEventListener("input", function () {
        const searchValue = this.value.toLowerCase().trim();

        // Search only inventory products.
        if (activeTab !== "sales") return;

        const filteredProducts = allProducts.filter(function (product) {
            return (
                String(product.id).includes(searchValue) ||
                (product.product_name || "").toLowerCase().includes(searchValue) ||
                (product.sku || "").toLowerCase().includes(searchValue) ||
                (product.category || "").toLowerCase().includes(searchValue)
            );
        });

        showRows(filteredProducts.map(productToRow));
    });
}


/* =========================================
   10. DASHBOARD AND SALE PAGE NAVIGATION
========================================= */

const dashboardView = document.getElementById("dashboardView");
const saleView = document.getElementById("saleView");

const dashboardMenu = document.getElementById("dashboardMenu");
const saleMenu = document.getElementById("saleMenu");

function setActiveMenu(activeLink) {
    document.querySelectorAll(".sidebar-menu a").forEach(function (link) {
        link.classList.remove("active");
    });

    if (activeLink) {
        activeLink.classList.add("active");
    }
}

if (saleMenu && dashboardView && saleView) {
    saleMenu.addEventListener("click", function (event) {
        event.preventDefault();

        dashboardView.hidden = true;
        saleView.hidden = false;

        if (productView) {
            productView.hidden = true;
        }

        setActiveMenu(saleMenu);
    });
}

if (dashboardMenu && dashboardView && saleView) {
    dashboardMenu.addEventListener("click", function (event) {
        event.preventDefault();

        saleView.hidden = true;
        dashboardView.hidden = false;

        if (productView) {
            productView.hidden = true;
        }

        setActiveMenu(dashboardMenu);

        loadTab(activeTab);
    });
}


/* =========================================
   11. SALE FORM ELEMENTS
========================================= */

const saleSearchInput = document.getElementById("saleProductSearch");
const saleResults = document.getElementById("saleProductResults");

const saleProductIdInput = document.getElementById("saleProductId");
const saleSkuInput = document.getElementById("saleSku");
const salePriceInput = document.getElementById("salePrice");
const saleQuantityInput = document.getElementById("saleQuantity");

const selectedProductName = document.getElementById("selectedProductName");
const selectedProductStock = document.getElementById("selectedProductStock");
const saleTotalPreview = document.getElementById("saleTotalPreview");

const saleFormElement = document.getElementById("saleForm");

let saleProductsCache = [];
let selectedSaleProduct = null;


/* =========================================
   12. LOAD PRODUCTS FOR SALE FORM
========================================= */

async function loadSaleProducts() {
    if (saleResults) {
        saleResults.textContent = "Loading products...";
    }

    const { data, error } = await supabaseClient
        .from("products")
        .select(`
            id,
            product_name,
            sku,
            selling_price,
            current_stock,
            unit_type,
            unit_quantity
        `)
        .order("product_name", { ascending: true });

    if (error) {
        console.error("Sale products loading error:", error);

        if (saleResults) {
            saleResults.textContent =
                "Products load nahi hue. Console check karein.";
        }

        return;
    }

    saleProductsCache = data || [];

    if (saleResults) {
        saleResults.textContent = saleProductsCache.length
            ? "Product search karein aur product select karein."
            : "Products table mein koi product nahi mila.";
    }
}


/* =========================================
   13. SEARCH PRODUCTS IN SALE FORM
========================================= */

function showSaleProductResults(searchText) {
    if (!saleResults) return;

    saleResults.innerHTML = "";

    const query = searchText.toLowerCase().trim();

    if (!query) {
        saleResults.textContent = "Product name ya SKU enter karein.";
        return;
    }

    const matches = saleProductsCache.filter(function (product) {
        return (
            (product.product_name || "").toLowerCase().includes(query) ||
            (product.sku || "").toLowerCase().includes(query)
        );
    }).slice(0, 20);

    if (matches.length === 0) {
        saleResults.textContent = "Koi matching product nahi mila.";
        return;
    }

    matches.forEach(function (product) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "sale-product-result";

        const name = document.createElement("strong");
        name.textContent = product.product_name || "Unnamed product";

        const details = document.createElement("span");

        details.textContent =
            `SKU: ${product.sku || "—"} | ` +
            `Price: ${formatPrice(product.selling_price)} | ` +
            `Stock: ${product.current_stock ?? 0} ` +
            `${product.unit_type || "piece"}`;

        button.appendChild(name);
        button.appendChild(details);

        button.addEventListener("click", function () {
            selectSaleProduct(product);
        });

        saleResults.appendChild(button);
    });
}


/* =========================================
   14. SELECT PRODUCT FOR SALE
========================================= */

function selectSaleProduct(product) {
    selectedSaleProduct = product;

    if (saleProductIdInput) {
        saleProductIdInput.value = product.id;
    }

    if (saleSkuInput) {
        saleSkuInput.value = product.sku || "";
    }

    if (salePriceInput) {
        salePriceInput.value = Number(product.selling_price || 0).toFixed(2);
    }

    if (selectedProductName) {
        selectedProductName.textContent =
            product.product_name || "Unnamed product";
    }

    if (selectedProductStock) {
        selectedProductStock.textContent =
            `Available stock: ${product.current_stock ?? 0} ` +
            `${product.unit_type || "piece"}`;
    }

    if (saleQuantityInput) {
        const stock = Number(product.current_stock || 0);

        saleQuantityInput.innerHTML = "";

        if (stock <= 0) {
            const option = document.createElement("option");

            option.value = "";
            option.textContent = "Out of stock";

            saleQuantityInput.appendChild(option);
            saleQuantityInput.disabled = true;

        } else {
            saleQuantityInput.disabled = false;

            // Sale quantity is limited by available stock.
            for (let i = 1; i <= Math.floor(stock); i++) {
                const option = document.createElement("option");

                option.value = String(i);
                option.textContent = String(i);

                saleQuantityInput.appendChild(option);
            }

            saleQuantityInput.value = "1";
        }
    }

    if (saleSearchInput) {
        saleSearchInput.value = product.product_name || "";
    }

    calculateSaleTotal();

    if (saleResults) {
        saleResults.innerHTML = "";
        saleResults.textContent = "Product selected.";
    }
}


/* =========================================
   15. CALCULATE SALE TOTAL
========================================= */

function calculateSaleTotal() {
    const price = Number(salePriceInput?.value || 0);
    const quantity = Number(saleQuantityInput?.value || 0);

    const total = price * quantity;

    if (saleTotalPreview) {
        saleTotalPreview.textContent = formatPrice(total);
    }
}

if (saleSearchInput) {
    saleSearchInput.addEventListener("input", function () {
        selectedSaleProduct = null;

        if (saleProductIdInput) {
            saleProductIdInput.value = "";
        }

        showSaleProductResults(this.value);
    });
}

if (salePriceInput) {
    salePriceInput.addEventListener("input", calculateSaleTotal);
}

if (saleQuantityInput) {
    saleQuantityInput.addEventListener("change", calculateSaleTotal);
}


/* =========================================
   16. SAVE SALE AND REDUCE STOCK
========================================= */

if (saleFormElement) {
    saleFormElement.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!selectedSaleProduct) {
            alert("Please select a product first.");
            return;
        }

        const customerInput = document.getElementById("saleCustomerName");
        const paymentInput = document.getElementById("salePaymentType");

        const customerName = customerInput?.value.trim() || "";
        const quantity = Number(saleQuantityInput?.value || 0);
        const sellingPrice = Number(salePriceInput?.value || 0);
        const paymentType = paymentInput?.value || "";

        if (
            !customerName ||
            quantity <= 0 ||
            !Number.isFinite(sellingPrice) ||
            sellingPrice < 0 ||
            !paymentType
        ) {
            alert("Please fill all required fields correctly.");
            return;
        }

        if (quantity > Number(selectedSaleProduct.current_stock || 0)) {
            alert("Available stock se zyada quantity sell nahi kar sakte.");
            return;
        }

        const submitButton = saleFormElement.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            const { data, error } = await supabaseClient.rpc(
                "save_sale_and_update_stock",
                {
                    p_product_id: Number(selectedSaleProduct.id),
                    p_customer_name: customerName,
                    p_quantity: quantity,
                    p_selling_price: sellingPrice,
                    p_payment_type: paymentType
                }
            );

            if (error) {
                throw error;
            }

            alert(`Sale saved successfully! Sale ID: ${data}`);

            saleFormElement.reset();
            selectedSaleProduct = null;

            if (saleProductIdInput) {
                saleProductIdInput.value = "";
            }

            if (selectedProductName) {
                selectedProductName.textContent = "No product selected";
            }

            if (selectedProductStock) {
                selectedProductStock.textContent = "";
            }

            if (saleResults) {
                saleResults.textContent = "Product search karein.";
            }

            await fetchAllProducts();
            await loadSaleProducts();
            await loadTab(activeTab);

        } catch (error) {
            console.error("Sale save error:", error);

            alert("Sale save nahi hui: " + (error.message || "Unknown error"));

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}


/* =========================================
   17. INITIALIZE DASHBOARD
========================================= */

async function initializeDashboard() {
    await loadTab("sales");
    await loadSaleProducts();
}

initializeDashboard();


/* =========================================
   18. SALE PRODUCT TABLE + DATE FILTER
========================================= */

const saleDateFilter = document.getElementById("saleDateFilter");
const saleStartDate = document.getElementById("saleStartDate");
const saleEndDate = document.getElementById("saleEndDate");
const filterSalesBtn = document.getElementById("filterSalesBtn");
const resetSalesFilterBtn = document.getElementById("resetSalesFilterBtn");

function saleDateLabel(value) {
    if (!value) return "—";

    return formatDate(value);
}

async function loadSaleRecords() {
    const startDate = saleStartDate?.value || "";
    const endDate = saleEndDate?.value || "";

    if (startDate && endDate && startDate > endDate) {
        showError("From Date, To Date se pehle honi chahiye.");
        return;
    }

    showLoading();

    try {
        let query = supabaseClient
            .from("sale_products")
            .select(`
                id,
                product_name,
                sku,
                customer_name,
                quantity,
                selling_price,
                total_amount,
                payment_status,
                payment_type,
                sale_date
            `)
            .order("sale_date", { ascending: false });

        // Starting date inclusive.
        if (startDate) {
            query = query.gte("sale_date", startDate);
        }

        // Ending date inclusive, including records throughout that day.
        if (endDate) {
            const nextDate = new Date(`${endDate}T00:00:00`);

            nextDate.setDate(nextDate.getDate() + 1);

            const nextDateString =
                `${nextDate.getFullYear()}-` +
                `${String(nextDate.getMonth() + 1).padStart(2, "0")}-` +
                `${String(nextDate.getDate()).padStart(2, "0")}`;

            query = query.lt("sale_date", nextDateString);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        const rows = (data || []).map(function (sale) {
            return [
                escapeHTML(sale.id),
                escapeHTML(sale.product_name || "—"),
                escapeHTML(sale.sku || "—"),
                escapeHTML(sale.customer_name || "—"),
                escapeHTML(sale.quantity ?? 0),
                formatPrice(sale.selling_price),
                formatPrice(sale.total_amount),
                escapeHTML(sale.payment_status || "—"),
                escapeHTML(sale.payment_type || "—"),
                saleDateLabel(sale.sale_date)
            ];
        });

        showRows(rows);

    } catch (error) {
        console.error("Sale records loading error:", error);

        showError("Sales load nahi hui: " + error.message);
    }
}


/* Apply date filter */

if (filterSalesBtn) {
    filterSalesBtn.addEventListener("click", function () {
        if (activeTab === "coming") {
            loadSaleRecords();
        }
    });
}


/* Reset date filter */

if (resetSalesFilterBtn) {
    resetSalesFilterBtn.addEventListener("click", function () {
        if (saleStartDate) {
            saleStartDate.value = "";
        }

        if (saleEndDate) {
            saleEndDate.value = "";
        }

        if (activeTab === "coming") {
            loadSaleRecords();
        }
    });
}


/* =========================================
   19. PRODUCT PAGE NAVIGATION
========================================= */

const productsMenu = document.getElementById("productsMenu");
const productView = document.getElementById("productView");

if (productsMenu && productView) {
    productsMenu.addEventListener("click", function (event) {
        event.preventDefault();

        if (dashboardView) {
            dashboardView.hidden = true;
        }

        if (saleView) {
            saleView.hidden = true;
        }

        productView.hidden = false;

        setActiveMenu(productsMenu);
    });
}

/* =========================================
   19.1 SEARCH EXISTING PRODUCTS
========================================= */

let selectedExistingProduct = null;

const existingProductSearch =
    document.getElementById("existingProductSearch");

const productSuggestions =
    document.getElementById("productSuggestions");

const clearSelectedProduct =
    document.getElementById("clearSelectedProduct");

const selectedProductMessage =
    document.getElementById("selectedProductMessage");


if (existingProductSearch) {
    existingProductSearch.addEventListener("input", async function () {

        const searchText = this.value.trim();

        productSuggestions.innerHTML = "";

        selectedExistingProduct = null;

        clearSelectedProduct.hidden = true;
        selectedProductMessage.textContent = "";

        if (searchText.length < 2) return;

        const safeSearch = searchText.replace(/[%_,]/g, "");

        const { data, error } = await supabaseClient
            .from("products")
            .select(`
                id,
                product_name,
                sku,
                category,
                purchase_price,
                selling_price,
                current_stock,
                main_stock,
                min_stock,
                unit_type,
                unit_quantity
            `)
            .or(
                `product_name.ilike.%${safeSearch}%,sku.ilike.%${safeSearch}%`
            )
            .limit(10);

        if (error) {
            console.error("Product search error:", error);

            selectedProductMessage.textContent =
                "Product search karne mein error aaya.";

            return;
        }

        if (!data || data.length === 0) {
            productSuggestions.textContent =
                "Existing product Not Found.";

            return;
        }

        data.forEach(function (product) {

            const item = document.createElement("button");

            item.type = "button";
            item.className = "product-suggestion-item";

            item.textContent =
                `${product.product_name} | SKU: ${product.sku || "N/A"} | Stock: ${product.current_stock}`;

            item.addEventListener("click", function () {

                selectedExistingProduct = product;

                document.getElementById("productName").value =
                    product.product_name || "";

                document.getElementById("productSku").value =
                    product.sku || "";

                document.getElementById("productCategory").value =
                    product.category || "";

                document.getElementById("productUnit").value =
                    product.unit_type || "piece";

                document.getElementById("productUnitQuantity").value =
                    product.unit_quantity ?? 1;

                document.getElementById("purchasePrice").value =
                    product.purchase_price ?? 0;

                document.getElementById("sellingPrice").value =
                    product.selling_price ?? 0;

                document.getElementById("currentStock").value =
                    product.current_stock ?? 0;

                document.getElementById("mainStock").value =
                    product.main_stock ?? 0;

                document.getElementById("minStock").value =
                    product.min_stock ?? 5;

                existingProductSearch.value =
                    product.product_name || "";

                productSuggestions.innerHTML = "";

                selectedProductMessage.textContent =
                    `Selected: ${product.product_name}. Existing stock: ${product.current_stock}`;

                clearSelectedProduct.hidden = false;
            });

            productSuggestions.appendChild(item);
        });
    });
}


/* Add a new product instead */

if (clearSelectedProduct) {
    clearSelectedProduct.addEventListener("click", function () {

        selectedExistingProduct = null;

        productForm.reset();

        existingProductSearch.value = "";
        productSuggestions.innerHTML = "";
        selectedProductMessage.textContent = "";

        clearSelectedProduct.hidden = true;

        document.getElementById("minStock").value = 5;
        document.getElementById("productUnitQuantity").value = 1;
    });
}



/* =========================================
   20. SAVE OR UPDATE PRODUCT STOCK
========================================= */

const productForm = document.getElementById("productForm");
const productFormMessage = document.getElementById("productFormMessage");
const saveProductBtn = document.getElementById("saveProductBtn");

if (productForm) {
    productForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const productName =
            document.getElementById("productName").value.trim();

        const sku =
            document.getElementById("productSku").value.trim();

        const category =
            document.getElementById("productCategory").value.trim();

        const unitType =
            document.getElementById("productUnit").value;

        const unitQuantity =
            Number(document.getElementById("productUnitQuantity").value);

        const purchasePrice =
            Number(document.getElementById("purchasePrice").value);

        const sellingPrice =
            Number(document.getElementById("sellingPrice").value);

        const incomingQuantity =
            Number(document.getElementById("incomingQuantity").value);

        const minStock =
            Number(document.getElementById("minStock").value);

        if (
            !productName ||
            !unitType ||
            !Number.isFinite(unitQuantity) ||
            unitQuantity <= 0 ||
            !Number.isFinite(incomingQuantity) ||
            incomingQuantity <= 0 ||
            !Number.isFinite(purchasePrice) ||
            purchasePrice < 0 ||
            !Number.isFinite(sellingPrice) ||
            sellingPrice < 0 ||
            !Number.isFinite(minStock) ||
            minStock < 0
        ) {
            productFormMessage.textContent =
                "Please enter valid product details and incoming quantity.";

            return;
        }

        if (saveProductBtn) {
            saveProductBtn.disabled = true;
            saveProductBtn.textContent = "Saving...";
        }

        productFormMessage.textContent = "";

        try {
            let result;

            // EXISTING PRODUCT: add incoming stock
            if (selectedExistingProduct) {
                const product = selectedExistingProduct;

                const updatedCurrentStock =
                    Number(product.current_stock || 0) + incomingQuantity;

                const updatedMainStock =
                    Number(product.main_stock || 0) + incomingQuantity;

                result = await supabaseClient
                    .from("products")
                    .update({
                        current_stock: updatedCurrentStock,
                        main_stock: updatedMainStock,
                        purchase_price: purchasePrice,
                        selling_price: sellingPrice,
                        min_stock: minStock
                    })
                    .eq("id", product.id)
                    .select();

            } else {
                // NEW PRODUCT: check whether SKU already exists
                if (sku) {
                    const { data: existingSku, error: skuError } =
                        await supabaseClient
                            .from("products")
                            .select("id, product_name, sku")
                            .eq("sku", sku)
                            .maybeSingle();

                    if (skuError) throw skuError;

                    if (existingSku) {
                        throw new Error(
                            "This SKU already exists. Search and select the existing product first."
                        );
                    }
                }

                const productData = {
                    product_name: productName,
                    sku: sku || null,
                    category: category || null,
                    purchase_price: purchasePrice,
                    selling_price: sellingPrice,
                    current_stock: incomingQuantity,
                    main_stock: incomingQuantity,
                    min_stock: minStock,
                    unit_type: unitType,
                    unit_quantity: unitQuantity
                };

                result = await supabaseClient
                    .from("products")
                    .insert([productData])
                    .select();
            }

            if (result.error) throw result.error;

            productFormMessage.textContent = selectedExistingProduct
                ? `Stock updated! Added ${incomingQuantity}. Current and main stock are now updated.`
                : "New product successfully saved!";

            productForm.reset();

            const existingSearch =
                document.getElementById("existingProductSearch");

            const suggestions =
                document.getElementById("productSuggestions");

            const clearButton =
                document.getElementById("clearSelectedProduct");

            const selectedMessage =
                document.getElementById("selectedProductMessage");

            if (existingSearch) existingSearch.value = "";
            if (suggestions) suggestions.innerHTML = "";
            if (clearButton) clearButton.hidden = true;
            if (selectedMessage) selectedMessage.textContent = "";

            selectedExistingProduct = null;

            document.getElementById("minStock").value = 5;
            document.getElementById("productUnitQuantity").value = 1;
            document.getElementById("incomingQuantity").value = 1;

            await fetchAllProducts();
            await loadSaleProducts();

            if (activeTab === "sales" || activeTab === "low") {
                await loadTab(activeTab);
            }

        } catch (error) {
            console.error("Product save error:", error);

            productFormMessage.textContent =
                "Product save nahi hua: " + error.message;

        } finally {
            if (saveProductBtn) {
                saveProductBtn.disabled = false;
                saveProductBtn.textContent = "Save Product";
            }
        }
    });
}


/* =========================================
   STOCK MANAGEMENT: ENTRY + VIEW
========================================= */

const stockMenu = document.getElementById("stockMenu");
const stockView = document.getElementById("stockView");

const lowStockForm = document.getElementById("lowStockForm");
const lowStockFormMessage = document.getElementById("lowStockFormMessage");
const lowStockTableBody = document.getElementById("lowStockTableBody");
const lowStockViewMessage = document.getElementById("lowStockViewMessage");

const lowStockEntryPanel = document.getElementById("lowStockEntryPanel");
const lowStockViewPanel = document.getElementById("lowStockViewPanel");

const stockRequestTabs = document.querySelectorAll(".stock-request-tab");


// 1. OPEN STOCK PAGE FROM SIDEBAR
if (stockMenu && stockView) {
    stockMenu.addEventListener("click", async function (event) {
        event.preventDefault();

        document.getElementById("dashboardView").hidden = true;
        document.getElementById("productView").hidden = true;
        document.getElementById("saleView").hidden = true;
        stockView.hidden = false;

        if (typeof setActiveMenu === "function") {
            setActiveMenu(stockMenu);
        }

        await loadLowStockRequests();
    });
}


// 2. HIDE STOCK PAGE WHEN OPENING ANOTHER PAGE
["dashboardMenu", "productsMenu", "saleMenu"].forEach(function (menuId) {
    const menu = document.getElementById(menuId);

    if (menu) {
        menu.addEventListener("click", function () {
            if (stockView) stockView.hidden = true;
        });
    }
});


// 3. SWITCH BETWEEN ENTRY AND VIEW TABS
stockRequestTabs.forEach(function (tab) {
    tab.addEventListener("click", async function () {
        stockRequestTabs.forEach(function (item) {
            item.classList.remove("active");
        });

        tab.classList.add("active");

        const selectedTab = tab.dataset.stockTab;

        lowStockEntryPanel.hidden = selectedTab !== "entry";
        lowStockViewPanel.hidden = selectedTab !== "view";

        if (selectedTab === "view") {
            await loadLowStockRequests();
        }
    });
});


// 4. SAFE TEXT DISPLAY IN TABLE
function escapeLowStockText(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}


// 5. SAVE LOW STOCK REQUEST TO SUPABASE
if (lowStockForm) {
    lowStockForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const requestData = {
            product_name: document.getElementById("lowProductName").value.trim(),
            product_category: document.getElementById("lowProductCategory").value.trim() || null,
            product_unit: document.getElementById("lowProductUnit").value,
            product_color: document.getElementById("lowProductColor").value.trim() || null,
            product_box: document.getElementById("lowProductBox").value.trim() || null,
            description: document.getElementById("lowProductDescription").value.trim() || null
        };

        if (!requestData.product_name || !requestData.product_unit) {
            lowStockFormMessage.textContent =
                "Please enter Product Name and Product Unit.";
            return;
        }

        const saveButton = document.getElementById("saveLowStockBtn");
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
        lowStockFormMessage.textContent = "";

        try {
            const { error } = await supabaseClient
                .from("low_stock_requests")
                .insert([requestData]);

            if (error) throw error;

            lowStockFormMessage.textContent =
                "Product reorder request successfully saved!";

            lowStockForm.reset();

            await loadLowStockRequests();

        } catch (error) {
            console.error("Low stock save error:", error);

            lowStockFormMessage.textContent =
                "Save failed: " + error.message;

        } finally {
            saveButton.disabled = false;
            saveButton.textContent = "Submit Request";
        }
    });
}


// 6. LOAD SAVED REQUESTS FROM SUPABASE
async function loadLowStockRequests() {
    if (!lowStockTableBody) return;

    lowStockTableBody.innerHTML =
        '<tr><td colspan="8">Loading requests...</td></tr>';

    lowStockViewMessage.textContent = "";

    try {
        const { data, error } = await supabaseClient
            .from("low_stock_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            lowStockTableBody.innerHTML =
                '<tr><td colspan="9">No reorder requests found.</td></tr>';

            lowStockViewMessage.textContent =
                "Abhi koi product request save nahi hai.";
            return;
        }

        lowStockTableBody.innerHTML = data.map(function (product) {
            const date = product.created_at
                ? new Date(product.created_at).toLocaleDateString("en-IN")
                : "-";

            return `
                <tr>
                    <td>${escapeLowStockText(product.id)}</td>
                    <td>${escapeLowStockText(product.product_name)}</td>
                    <td>${escapeLowStockText(product.product_category || "-")}</td>
                    <td>${escapeLowStockText(product.product_unit || "-")}</td>
                    <td>${escapeLowStockText(product.product_color || "-")}</td>
                    <td>${escapeLowStockText(product.product_box || "-")}</td>
                    <td>${escapeLowStockText(product.description || "-")}</td>
                    <td>${escapeLowStockText(date)}</td>

                    <td>
                        <button
                            type="button"
                            class="delete-low-stock-btn"
                            data-id="${escapeLowStockText(product.id)}">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </td>


                </tr>
            `;
        }).join("");

        lowStockViewMessage.textContent =
            `${data.length} reorder request(s) found.`;

    } catch (error) {
        console.error("Low stock load error:", error);

        lowStockTableBody.innerHTML =
            '<tr><td colspan="9">Could not load requests.</td></tr>';

        lowStockViewMessage.textContent =
            "Error: " + error.message;
    }
    
}


/* DELETE LOW STOCK REQUEST */

if (lowStockTableBody) {
    lowStockTableBody.addEventListener("click", async function (event) {
        const button = event.target.closest(".delete-low-stock-btn");

        if (!button) return;

        const productId = button.dataset.id;

        if (!confirm("Kya aap is product request ko delete karna chahte hain?")) {
            return;
        }

        button.disabled = true;
        button.textContent = "Deleting...";

        try {
            const { error } = await supabaseClient
                .from("low_stock_requests")
                .delete()
                .eq("id", productId);

            if (error) throw error;

            await loadLowStockRequests();

        } catch (error) {
            console.error("Delete error:", error);
            alert("Delete nahi hua: " + error.message);
            await loadLowStockRequests();
        }
    });
}


// 7. REFRESH BUTTON
const refreshLowStockBtn = document.getElementById("refreshLowStockBtn");

if (refreshLowStockBtn) {
    refreshLowStockBtn.addEventListener("click", loadLowStockRequests);
}


//   ----------------------   Responsive menu code -----------------------//


const menuButton = document.getElementById("menuButton");
const mobileSidebar = document.getElementById("sidebar");

if (menuButton && mobileSidebar) {
    menuButton.addEventListener("click", function () {
        const isOpen = mobileSidebar.classList.toggle("show");

        menuButton.setAttribute("aria-expanded", isOpen);

        menuButton.innerHTML = isOpen
            ? '<i class="fa-solid fa-xmark"></i>'
            : '<i class="fa-solid fa-bars"></i>';
    });

    // Menu item click hone par mobile sidebar band karo
    mobileSidebar.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
            if (window.innerWidth <= 650) {
                mobileSidebar.classList.remove("show");
                menuButton.setAttribute("aria-expanded", "false");
                menuButton.innerHTML =
                    '<i class="fa-solid fa-bars"></i>';
            }
        });
    });

    // Mobile se desktop par resize karne par menu reset karo
    window.addEventListener("resize", function () {
        if (window.innerWidth > 650) {
            mobileSidebar.classList.remove("show");
            menuButton.setAttribute("aria-expanded", "false");
            menuButton.innerHTML =
                '<i class="fa-solid fa-bars"></i>';
        }
    });
}


// -------------------------------------------//
// -------Card data load function----------- //
// -------------------------------------------//


async function loadDashboardCards() {
    const totalProductsEl = document.getElementById("totalProducts");
    const todaySaleEl = document.getElementById("todaySale");
    const lowStockEl = document.getElementById("lowStockCount");

    try {
        // 1. Total products count
        const { count, error: productsError } = await supabaseClient
            .from("products")
            .select("id", { count: "exact", head: true });

        if (productsError) throw productsError;

        totalProductsEl.textContent = count ?? 0;

        // 2. Low stock products count
        const { data: products, error: stockError } = await supabaseClient
            .from("products")
            .select("current_stock, min_stock");

        if (stockError) throw stockError;

        const lowStockCount = (products || []).filter(product =>
            Number(product.current_stock || 0) <=
            Number(product.min_stock ?? 5)
        ).length;

        lowStockEl.textContent = lowStockCount;

        // 3. Today's total sales
        const now = new Date();

        // Aaj ki date ke local start aur next day ka start
        const start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );

        const end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1
        );

        const { data: sales, error: salesError } = await supabaseClient
            .from("sale_products")
            .select("total_amount, sale_date")
            .gte("sale_date", start.toISOString())
            .lt("sale_date", end.toISOString());

        if (salesError) throw salesError;

        const todayTotal = (sales || []).reduce(
            (total, sale) => total + Number(sale.total_amount || 0),
            0
        );

        todaySaleEl.textContent = todayTotal.toLocaleString("en-IN", {
            style: "currency",
            currency: "INR",
            minimumFractionDigits: 2
        });

    } catch (error) {
        console.error("Dashboard cards error:", error);
    }
}

// Dashboard cards load karo
loadDashboardCards();

