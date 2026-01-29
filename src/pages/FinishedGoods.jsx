import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Package, Search, ChevronRight, Plus } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import AddBatchDialog from '@/components/finishedgoods/AddBatchDialog';

const statusColors = {
  available: 'bg-emerald-100 text-emerald-700',
  quarantined: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
  depleted: 'bg-slate-100 text-slate-500'
};

const statusLabels = {
  available: 'Tillgänglig',
  quarantined: 'Karantän',
  blocked: 'Spärrad',
  depleted: 'Slut'
};

export default function FinishedGoods() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [addBatchProduct, setAddBatchProduct] = useState(null);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.Batch.list('-created_date')
  });

  const finishedGoods = useMemo(() => {
    return products.filter(p => p.type === 'finished_good');
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return finishedGoods;
    const search = searchTerm.toLowerCase();
    return finishedGoods.filter(p =>
      p.sku?.toLowerCase().includes(search) ||
      p.name?.toLowerCase().includes(search)
    );
  }, [finishedGoods, searchTerm]);

  const getProductBatches = (productId) => {
    return batches
      .filter(b => b.product_id === productId)
      .sort((a, b) => new Date(b.production_date) - new Date(a.production_date));
  };

  const getProductStats = (productId) => {
    const productBatches = getProductBatches(productId);
    const activeBatches = productBatches.filter(b => b.status !== 'depleted');
    const totalStock = activeBatches.reduce((sum, b) => sum + (b.current_quantity || 0), 0);
    return {
      totalBatches: productBatches.length,
      activeBatches: activeBatches.length,
      totalStock
    };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Färdiga produkter</h1>
          <p className="text-slate-500 mt-1">Hantera färdigvaror och deras batcher</p>
        </div>

        {/* Search */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Sök efter SKU eller produktnamn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Products List */}
        <div className="space-y-4">
          {filteredProducts.map((product) => {
            const stats = getProductStats(product.id);
            const productBatches = getProductBatches(product.id);
            const isExpanded = expandedProduct === product.id;

            return (
              <Card key={product.id} className="overflow-hidden">
                <CardHeader 
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-slate-400" />
                        <div>
                          <CardTitle className="text-lg">
                            <span className="font-mono text-slate-600">{product.sku}</span>
                            <span className="mx-2 text-slate-300">•</span>
                            <span>{product.name}</span>
                          </CardTitle>
                          <div className="flex gap-4 mt-2 text-sm text-slate-500">
                            <span>{stats.totalBatches} batcher totalt</span>
                            <span>•</span>
                            <span>{stats.activeBatches} aktiva</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">
                              {stats.totalStock.toLocaleString('sv-SE')} {product.unit} i lager
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mr-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddBatchProduct(product);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Lägg till batch
                      </Button>
                    </div>
                    <ChevronRight 
                      className={cn(
                        "w-5 h-5 text-slate-400 transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    {productBatches.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Batchnummer</TableHead>
                            <TableHead>Produktionsdatum</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Producerad mängd</TableHead>
                            <TableHead className="text-right">Kvar</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productBatches.map((batch) => (
                            <TableRow key={batch.id} className="hover:bg-slate-50">
                              <TableCell className="font-mono text-sm">
                                {batch.batch_number}
                              </TableCell>
                              <TableCell className="text-slate-500">
                                {batch.production_date && format(new Date(batch.production_date), 'd MMM yyyy', { locale: sv })}
                              </TableCell>
                              <TableCell>
                                <Badge className={cn(statusColors[batch.status], "font-normal text-xs")}>
                                  {statusLabels[batch.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-slate-500">
                                {batch.produced_quantity?.toLocaleString('sv-SE')}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {batch.current_quantity?.toLocaleString('sv-SE')}
                              </TableCell>
                              <TableCell>
                                <Link to={`${createPageUrl('Batches')}?batch=${batch.id}`}>
                                  <Button variant="ghost" size="sm">
                                    Detaljer
                                  </Button>
                                </Link>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Inga batcher än för denna produkt</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}

          {filteredProducts.length === 0 && (
            <Card className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
              <p className="text-slate-500">Inga färdigvaror hittades</p>
            </Card>
          )}
        </div>
      </div>

      {addBatchProduct && (
        <AddBatchDialog
          product={addBatchProduct}
          open={!!addBatchProduct}
          onOpenChange={(open) => !open && setAddBatchProduct(null)}
        />
      )}
    </div>
  );
}