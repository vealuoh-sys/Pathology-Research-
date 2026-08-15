const fs = require('fs');
let file = fs.readFileSync('src/LabResearchAgent.tsx', 'utf-8');

const newImports = `
import { Button } from "@/components/ui/button";
import { Card as ShadCard, CardContent as ShadCardContent, CardHeader as ShadCardHeader, CardTitle as ShadCardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge as ShadBadge } from "@/components/ui/badge";
import { Progress as ShadProgress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, Metric, Text, ProgressBar, Badge, BarList, List, ListItem, Tracker } from "@/components/tremor";
`;

file = file.replace(/import jStat from 'jstat';/, "import jStat from 'jstat';\n" + newImports);

fs.writeFileSync('src/LabResearchAgent.tsx', file);
