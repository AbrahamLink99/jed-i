import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Database, Workflow, AlertTriangle, Zap, ShoppingBag } from 'lucide-react';

export default function SystemGuide() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Systemguide - JED-I Lagermaster
          </CardTitle>
          <CardDescription>
            Komplett guide för hur systemet fungerar, arkitektur och felsökning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            
            {/* Systemöversikt */}
            <AccordionItem value="overview">
              <AccordionTrigger className="text-lg font-semibold">
                📋 Systemöversikt
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <p className="text-slate-700">
                  JED-I är ett komplett system för lager- och produktionshantering med följande huvudfunktioner:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-cyan-50 rounded-lg">
                    <h4 className="font-semibold text-cyan-900">Artikelhantering</h4>
                    <p className="text-sm text-cyan-700">Råvaror, förpackning, etiketter och färdigvaror</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900">Recepthantering (BOM)</h4>
                    <p className="text-sm text-blue-700">Bill of Materials för alla färdigvaror</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-purple-900">Produktion</h4>
                    <p className="text-sm text-purple-700">Tillverkning av blandningar och tappning</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <h4 className="font-semibold text-green-900">Lagerhantering</h4>
                    <p className="text-sm text-green-700">Realtidsspårning med ledger-baserat system</p>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <h4 className="font-semibold text-orange-900">Shopify-integration</h4>
                    <p className="text-sm text-orange-700">Synkronisering av lager till webbshop</p>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <h4 className="font-semibold text-yellow-900">Notiser & Varningar</h4>
                    <p className="text-sm text-yellow-700">Automatiska påfyllningsnotiser</p>
                  </div>
                </div>
                
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Miljöer:</strong> Systemet har två miljöer - <Badge>production</Badge> för verklig data och <Badge variant="outline">sandbox</Badge> för test.
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            {/* Entities */}
            <AccordionItem value="entities">
              <AccordionTrigger className="text-lg font-semibold">
                <Database className="w-5 h-5 mr-2" />
                Databasstrukttur (Entities)
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="space-y-3">
                  <div className="border-l-4 border-cyan-500 pl-4 py-2">
                    <h4 className="font-semibold text-cyan-900">Product</h4>
                    <p className="text-sm text-slate-600">Alla artiklar (råvaror, förpackning, etiketter, färdigvaror). Huvudfält: sku, name, type, unit, safety_stock, lead_time_days</p>
                  </div>
                  
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <h4 className="font-semibold text-blue-900">BOMItem</h4>
                    <p className="text-sm text-slate-600">Recept - kopplar färdigvara till komponenter. Fält: finished_product_id, component_id, quantity_per_unit</p>
                  </div>
                  
                  <div className="border-l-4 border-green-500 pl-4 py-2">
                    <h4 className="font-semibold text-green-900">InventoryLedger</h4>
                    <p className="text-sm text-slate-600">ALLA lagertransaktioner (inbound, production, backflush, adjustment, scrap). Denna entity är källan till sanning för lagersaldo.</p>
                    <p className="text-xs text-slate-500 mt-1">📌 Aktuellt saldo = SUM(quantity) för varje product_sku</p>
                  </div>
                  
                  <div className="border-l-4 border-purple-500 pl-4 py-2">
                    <h4 className="font-semibold text-purple-900">Batch / BatchLot</h4>
                    <p className="text-sm text-slate-600">Spårning av tillverkade batcher. Fält: batch_number, product_id, produced_quantity, current_quantity, status</p>
                  </div>
                  
                  <div className="border-l-4 border-pink-500 pl-4 py-2">
                    <h4 className="font-semibold text-pink-900">MixBatch</h4>
                    <p className="text-sm text-slate-600">Tillverkad blandning som ska tappas. Fält: mix_sku, batch_no, produced_kg, remaining_kg, status</p>
                  </div>
                  
                  <div className="border-l-4 border-indigo-500 pl-4 py-2">
                    <h4 className="font-semibold text-indigo-900">PackagingRecipe</h4>
                    <p className="text-sm text-slate-600">Recept för tappning - definierar hur blandning blir färdigvara. Fält: mix_sku, finished_sku, fill_ml_per_unit, components[]</p>
                  </div>
                  
                  <div className="border-l-4 border-orange-500 pl-4 py-2">
                    <h4 className="font-semibold text-orange-900">FillingReport</h4>
                    <p className="text-sm text-slate-600">Dokumentation av tappning. Sparar vilka varor som tappats, komponenter förbrukade, bulk förbrukad</p>
                  </div>
                  
                  <div className="border-l-4 border-red-500 pl-4 py-2">
                    <h4 className="font-semibold text-red-900">InventoryAlert</h4>
                    <p className="text-sm text-slate-600">Automatiska notiser för lagerbrist. Fält: product_id, severity, type, status, suggested_order_qty</p>
                  </div>
                  
                  <div className="border-l-4 border-slate-500 pl-4 py-2">
                    <h4 className="font-semibold text-slate-900">ShopifyConnection</h4>
                    <p className="text-sm text-slate-600">OAuth-anslutning till Shopify. Fält: shop_domain, access_token, scopes, status</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Arbetsflöden */}
            <AccordionItem value="workflows">
              <AccordionTrigger className="text-lg font-semibold">
                <Workflow className="w-5 h-5 mr-2" />
                Huvudarbetsflöden
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <h4 className="font-semibold text-slate-900">1️⃣ Inköp av råvaror</h4>
                  <ol className="text-sm space-y-1 ml-4 list-decimal text-slate-700">
                    <li>Gå till <strong>Lager</strong> → Skapa transaktion</li>
                    <li>Välj typ: "Inleverans"</li>
                    <li>Välj artikel (råvara/förpackning/etikett)</li>
                    <li>Ange antal → Spara</li>
                    <li>System skapar InventoryLedger med transaction_type="inbound"</li>
                  </ol>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <h4 className="font-semibold text-slate-900">2️⃣ Skapa recept (BOM)</h4>
                  <ol className="text-sm space-y-1 ml-4 list-decimal text-slate-700">
                    <li>Gå till <strong>Recept</strong></li>
                    <li>Välj färdigvara</li>
                    <li>Lägg till komponenter (råvaror) med mängd per enhet</li>
                    <li>Systemet sparar BOMItem för varje komponent</li>
                  </ol>
                  <p className="text-xs text-slate-500">💡 quantity_per_unit = mängd per 1 kg färdigvara</p>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <h4 className="font-semibold text-slate-900">3️⃣ Tillverkning/Produktion</h4>
                  <ol className="text-sm space-y-1 ml-4 list-decimal text-slate-700">
                    <li>Gå till <strong>Produktion</strong> → Ny produktion</li>
                    <li>Välj färdigvara och mängd</li>
                    <li>System visar komponenter som behövs (från BOM)</li>
                    <li>Bekräfta → System skapar:
                      <ul className="ml-4 mt-1 space-y-1">
                        <li>• Batch med tillverkat antal</li>
                        <li>• InventoryLedger: +quantity för färdigvaran (production)</li>
                        <li>• InventoryLedger: -quantity för varje komponent (backflush)</li>
                      </ul>
                    </li>
                  </ol>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <h4 className="font-semibold text-slate-900">4️⃣ Tappning (ny funktion)</h4>
                  <ol className="text-sm space-y-1 ml-4 list-decimal text-slate-700">
                    <li>Skapa MixBatch (blandning tillverkad i bulk)</li>
                    <li>Skapa PackagingRecipe för varje variant</li>
                    <li>Gå till <strong>Tappning</strong> → Ny tappning</li>
                    <li>Välj MixBatch</li>
                    <li>Fyll i antal per variant</li>
                    <li>System visar preview: bulk förbrukad, komponenter</li>
                    <li>Slutför → System:
                      <ul className="ml-4 mt-1 space-y-1">
                        <li>• Minskar MixBatch.remaining_kg</li>
                        <li>• Lägger till färdigvaror (+quantity)</li>
                        <li>• Drar av förpackningskomponenter (-quantity)</li>
                        <li>• Sparar FillingReport</li>
                      </ul>
                    </li>
                  </ol>
                </div>
                
                <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                  <h4 className="font-semibold text-slate-900">5️⃣ Shopify-synkronisering</h4>
                  <ol className="text-sm space-y-1 ml-4 list-decimal text-slate-700">
                    <li>Admin → Shopify-flik → Anslut butik (OAuth)</li>
                    <li>System sparar ShopifyConnection med access_token</li>
                    <li>Synk inventory → Backend-funktion:
                      <ul className="ml-4 mt-1 space-y-1">
                        <li>• Hämtar alla variants från Shopify</li>
                        <li>• Matchar SKU med Products</li>
                        <li>• Beräknar tillgängligt saldo från InventoryLedger</li>
                        <li>• Drar av shopify_buffer</li>
                        <li>• Uppdaterar inventory_quantity via Shopify API</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Backend Functions */}
            <AccordionItem value="functions">
              <AccordionTrigger className="text-lg font-semibold">
                <Zap className="w-5 h-5 mr-2" />
                Backend-funktioner
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="space-y-2">
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold text-sm">shopifyOAuthStart</h4>
                    <p className="text-xs text-slate-600">Startar OAuth-flödet, redirectar till Shopify för autentisering</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold text-sm">shopifyOAuthCallback</h4>
                    <p className="text-xs text-slate-600">Tar emot OAuth-callback, hämtar access token, sparar ShopifyConnection</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold text-sm">shopifyInventorySync</h4>
                    <p className="text-xs text-slate-600">Synkar lagersaldo från JED-I till Shopify för alla matchade SKUs</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold text-sm">shopifyHistoricalImport</h4>
                    <p className="text-xs text-slate-600">Importerar historisk försäljningsdata från Shopify för analys</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold text-sm">computeFillingReportPreview</h4>
                    <p className="text-xs text-slate-600">Beräknar bulk & komponentförbrukning innan tappning (preview)</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <h4 className="font-semibold text-sm">completeFillingReport</h4>
                    <p className="text-xs text-slate-600">Slutför tappning: uppdaterar MixBatch, skapar ledger-poster, sparar rapport</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Felkoder */}
            <AccordionItem value="errors">
              <AccordionTrigger className="text-lg font-semibold">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Vanliga fel och lösningar
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>401 Unauthorized</strong><br/>
                    <span className="text-sm">Användaren är inte inloggad eller sessionen har gått ut.</span><br/>
                    <span className="text-xs">✅ Lösning: Logga in igen</span>
                  </AlertDescription>
                </Alert>
                
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>403 Forbidden</strong><br/>
                    <span className="text-sm">Användaren saknar behörighet (inte admin).</span><br/>
                    <span className="text-xs">✅ Lösning: Kontrollera user.role - måste vara "admin" för admin-funktioner</span>
                  </AlertDescription>
                </Alert>
                
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>404 Not Found</strong><br/>
                    <span className="text-sm">Entity eller funktion hittades inte.</span><br/>
                    <span className="text-xs">✅ Lösning: Kontrollera ID eller SKU, se till att rätt environment används</span>
                  </AlertDescription>
                </Alert>
                
                <Alert variant="destructive">
                  <AlertDescription>
                    <strong>Shopify OAuth Error</strong><br/>
                    <span className="text-sm">OAuth-flödet misslyckades eller access token ogiltigt.</span><br/>
                    <span className="text-xs">✅ Lösning: Kontrollera SHOPIFY_CLIENT_ID och SHOPIFY_CLIENT_SECRET i secrets, återanslut butiken</span>
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <AlertDescription>
                    <strong>Lagerbrist vid produktion</strong><br/>
                    <span className="text-sm">Inte tillräckligt med komponenter för att tillverka.</span><br/>
                    <span className="text-xs">✅ Lösning: Kontrollera InventoryLedger för komponenternas saldo, köp in mer råvara</span>
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <AlertDescription>
                    <strong>MixBatch depleted</strong><br/>
                    <span className="text-sm">remaining_kg är 0 eller negativ.</span><br/>
                    <span className="text-xs">✅ Lösning: Tillverka ny MixBatch eller välj annan batch för tappning</span>
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <AlertDescription>
                    <strong>BOM saknas</strong><br/>
                    <span className="text-sm">Försök tillverka färdigvara utan recept.</span><br/>
                    <span className="text-xs">✅ Lösning: Gå till Recept och skapa BOM för produkten</span>
                  </AlertDescription>
                </Alert>
                
                <Alert>
                  <AlertDescription>
                    <strong>PackagingRecipe saknas</strong><br/>
                    <span className="text-sm">Försök tappa från MixBatch utan tappningsrecept.</span><br/>
                    <span className="text-xs">✅ Lösning: Skapa PackagingRecipe för mix_sku med fill_ml och komponenter</span>
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            {/* Best Practices */}
            <AccordionItem value="bestpractices">
              <AccordionTrigger className="text-lg font-semibold">
                ✅ Best Practices
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-semibold text-green-900">Använd sandbox för test</h4>
                  <p className="text-sm text-green-700">Testa nya funktioner i sandbox-miljön innan production. Använd environment-switcher i header.</p>
                </div>
                
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-900">Seed sandbox regelbundet</h4>
                  <p className="text-sm text-blue-700">Admin → Sandbox → "Skapa Sandbox Testdata" skapar komplett testdata för alla funktioner.</p>
                </div>
                
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h4 className="font-semibold text-purple-900">Aldrig redigera InventoryLedger manuellt</h4>
                  <p className="text-sm text-purple-700">Använd alltid transaktioner (inbound, production, adjustment). Ledger är immutable för spårbarhet.</p>
                </div>
                
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-semibold text-orange-900">Synka Shopify regelbundet</h4>
                  <p className="text-sm text-orange-700">Kör inventory sync efter större produktioner eller inköp för att hålla webshopen uppdaterad.</p>
                </div>
                
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-semibold text-yellow-900">Bevaka notiser</h4>
                  <p className="text-sm text-yellow-700">Kontrollera Notiser-sidan dagligen för lagervarningar och beställningsförslag.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Shortcuts */}
            <AccordionItem value="shortcuts">
              <AccordionTrigger className="text-lg font-semibold">
                ⚡ Snabbkommandon & Tips
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 border rounded">
                    <p className="text-sm"><strong>Kontrollera lagersaldo:</strong></p>
                    <p className="text-xs text-slate-600">Lager → Sök på SKU → Se transaktionshistorik</p>
                  </div>
                  <div className="p-3 border rounded">
                    <p className="text-sm"><strong>Hitta batch:</strong></p>
                    <p className="text-xs text-slate-600">Batcher → Filtrera på SKU eller batchnummer</p>
                  </div>
                  <div className="p-3 border rounded">
                    <p className="text-sm"><strong>Se vad som förbrukats:</strong></p>
                    <p className="text-xs text-slate-600">Lager → InventoryLedger → Filtrera transaction_type="backflush"</p>
                  </div>
                  <div className="p-3 border rounded">
                    <p className="text-sm"><strong>Redigera recept:</strong></p>
                    <p className="text-xs text-slate-600">Recept → Välj färdigvara → Redigera komponenter</p>
                  </div>
                  <div className="p-3 border rounded">
                    <p className="text-sm"><strong>Exportera data:</strong></p>
                    <p className="text-xs text-slate-600">Admin → Lagerinventering → Exportera till CSV</p>
                  </div>
                  <div className="p-3 border rounded">
                    <p className="text-sm"><strong>Återställ sandbox:</strong></p>
                    <p className="text-xs text-slate-600">Admin → Sandbox → "Rensa Sandbox" → "Skapa Testdata"</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}