import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from 'lucide-react';

export default function BatchSearch({ 
  searchTerm, 
  onSearchChange, 
  statusFilter, 
  onStatusChange 
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Sök batchnummer, SKU eller produkt..."
          className="pl-10"
        />
      </div>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Alla statusar" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alla statusar</SelectItem>
          <SelectItem value="available">Tillgänglig</SelectItem>
          <SelectItem value="quarantined">Karantän</SelectItem>
          <SelectItem value="blocked">Spärrad</SelectItem>
          <SelectItem value="depleted">Slut</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}