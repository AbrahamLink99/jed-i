import Admin from './pages/Admin';
import Alerts from './pages/Alerts';
import Batches from './pages/Batches';
import Dashboard from './pages/Dashboard';
import FinishedGoods from './pages/FinishedGoods';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Planning from './pages/Planning';
import Production from './pages/Production';
import Products from './pages/Products';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "Alerts": Alerts,
    "Batches": Batches,
    "Dashboard": Dashboard,
    "FinishedGoods": FinishedGoods,
    "Inventory": Inventory,
    "Orders": Orders,
    "Planning": Planning,
    "Production": Production,
    "Products": Products,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};