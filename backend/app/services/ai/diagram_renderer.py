import io
import base64
import os
import re
import logging
from typing import Optional, List, Tuple
from PIL import Image, ImageDraw, ImageFont

from app.services.ai.diagram_synthesizer import diagram_synthesizer, DiagramSpec, DiagramElement

logger = logging.getLogger(__name__)

class EducationalDiagramRenderer:
    """
    High-Yield Procedural 2D Educational Vector Diagram Renderer.
    Renders crisp, textbook-quality, topic-specific educational diagrams using Pillow.
    100% offline-ready, 0 network timeouts, 0 hallucinated text, aligned with Momo's theme.
    """

    def __init__(self):
        self.width = 920
        self.height = 600
        self.bg_color = (255, 255, 255)
        self.primary_purple = "#7F56D9"
        self.dark_purple = "#6941C6"
        self.light_purple_bg = "#F9F5FF"
        self.border_purple = "#E9D7FE"
        self.pill_purple = "#F4EBFF"
        self.text_dark = "#1D2939"
        self.text_body = "#344054"
        self.text_muted = "#667085"

        # Theme color accents
        self.blue_bg = "#F0F9FF"
        self.blue_border = "#B9E6FE"
        self.blue_text = "#026AA2"

        self.pink_bg = "#FDF2FA"
        self.pink_border = "#FCCEEE"
        self.pink_text = "#C11574"

        self.green_bg = "#ECFDF3"
        self.green_border = "#A6F4C5"
        self.green_text = "#027A48"

        self.orange_bg = "#FFF6ED"
        self.orange_border = "#FEDF89"
        self.orange_text = "#B54708"

        # Font paths
        self.font_candidates = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
            "/System/Library/Fonts/Geneva.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]

    def _get_font(self, size: int) -> ImageFont.ImageFont:
        for p in self.font_candidates:
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    continue
        return ImageFont.load_default()

    def _wrap_text(self, text: str, max_chars: int) -> List[str]:
        words = text.split()
        lines = []
        curr = ""
        for w in words:
            if len(curr) + len(w) + 1 > max_chars:
                if curr:
                    lines.append(curr.strip())
                curr = w + " "
            else:
                curr += w + " "
        if curr.strip():
            lines.append(curr.strip())
        return lines

    def _draw_header(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_badge = self._get_font(11)
        f_title = self._get_font(17)
        f_sub = self._get_font(12)
        f_pill = self._get_font(11)

        # Outer subtle rounded frame
        draw.rounded_rectangle([10, 10, w - 10, self.height - 10], radius=16, outline=self.border_purple, width=2)
        # Top banner background
        draw.rounded_rectangle([12, 12, w - 12, 84], radius=14, fill=self.light_purple_bg)

        # Momo AI Diagram badge pill
        draw.rounded_rectangle([26, 22, 180, 46], radius=12, fill=self.primary_purple)
        draw.text((36, 26), "MOMO AI DIAGRAM", fill="#FFFFFF", font=f_badge)

        # Topic Title
        clean_title = spec.title[:70]
        draw.text((195, 20), clean_title, fill=self.text_dark, font=f_title)

        # Subtitle
        clean_sub = spec.subtitle[:90]
        draw.text((195, 48), clean_sub, fill=self.text_muted, font=f_sub)

        # Top-Right Badge
        if spec.badge_label:
            badge_text = spec.badge_label[:38]
            draw.rounded_rectangle([w - 290, 22, w - 24, 48], radius=8, fill=self.green_bg, outline=self.green_border)
            draw.text((w - 280, 28), badge_text, fill=self.green_text, font=f_pill)

    def _draw_footer(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w, h = self.width, self.height
        f_label = self._get_font(12)
        f_body = self._get_font(11)

        takeaway = spec.key_takeaways[0] if spec.key_takeaways else f"Key exam concept governing {spec.topic}."
        subtext = spec.key_takeaways[1] if len(spec.key_takeaways) > 1 else ""

        draw.rounded_rectangle([20, h - 86, w - 20, h - 18], radius=10, fill=self.pill_purple, outline=self.border_purple)

        takeaway_lines = self._wrap_text(f"Exam Takeaway: {takeaway}", 105)
        if len(takeaway_lines) == 1 and subtext:
            draw.text((34, h - 74), takeaway_lines[0], fill=self.dark_purple, font=f_label)
            draw.text((34, h - 50), subtext[:120], fill=self.text_body, font=f_body)
        else:
            for t_i, t_line in enumerate(takeaway_lines[:2]):
                draw.text((34, h - 74 + t_i * 22), t_line, fill=self.dark_purple, font=f_label)

    # 1. ANATOMY / SYSTEMIC CIRCUITS (e.g. Human Heart, Nephron, Brain)
    def _draw_anatomy_system(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_sec = self._get_font(13)
        f_elem = self._get_font(12)
        f_desc = self._get_font(10)
        f_pill = self._get_font(9)

        col_w = 405
        col_h = 370
        start_y = 105

        # Left Column: Pulmonary / Deoxygenated circuit
        lx = 28
        draw.rounded_rectangle([lx, start_y, lx + col_w, start_y + col_h], radius=12, fill=self.blue_bg, outline=self.blue_border, width=2)
        draw.rounded_rectangle([lx + 14, start_y + 12, lx + col_w - 14, start_y + 40], radius=8, fill="#FFFFFF", outline=self.blue_border)
        draw.text((lx + 24, start_y + 18), "Right Side: Pulmonary Circuit (Deoxygenated)", fill=self.blue_text, font=f_sec)

        # Right Column: Systemic / Oxygenated circuit
        rx = w - col_w - 28
        draw.rounded_rectangle([rx, start_y, rx + col_w, start_y + col_h], radius=12, fill=self.pink_bg, outline=self.pink_border, width=2)
        draw.rounded_rectangle([rx + 14, start_y + 12, rx + col_w - 14, start_y + 40], radius=8, fill="#FFFFFF", outline=self.pink_border)
        draw.text((rx + 24, start_y + 18), "Left Side: Systemic Circuit (Oxygen-Rich)", fill=self.pink_text, font=f_sec)

        half = len(spec.elements) // 2
        left_elems = spec.elements[:half]
        right_elems = spec.elements[half:]

        card_h = 68
        card_w = col_w - 28

        for idx, elem in enumerate(left_elems[:4]):
            cy = start_y + 52 + idx * (card_h + 10)
            draw.rounded_rectangle([lx + 14, cy, lx + 14 + card_w, cy + card_h], radius=8, fill="#FFFFFF", outline=self.blue_border)
            if elem.badge:
                draw.rounded_rectangle([lx + card_w - 92, cy + 8, lx + card_w + 6, cy + 24], radius=4, fill=self.blue_bg)
                draw.text((lx + card_w - 86, cy + 10), elem.badge[:15], fill=self.blue_text, font=f_pill)
            draw.text((lx + 24, cy + 8), elem.label[:36], fill=self.text_dark, font=f_elem)
            lines = self._wrap_text(elem.subtext, 54)
            for l_i, line in enumerate(lines[:2]):
                draw.text((lx + 24, cy + 28 + l_i * 14), line, fill=self.text_muted, font=f_desc)

        for idx, elem in enumerate(right_elems[:4]):
            cy = start_y + 52 + idx * (card_h + 10)
            draw.rounded_rectangle([rx + 14, cy, rx + 14 + card_w, cy + card_h], radius=8, fill="#FFFFFF", outline=self.pink_border)
            if elem.badge:
                draw.rounded_rectangle([rx + card_w - 92, cy + 8, rx + card_w + 6, cy + 24], radius=4, fill=self.pink_bg)
                draw.text((rx + card_w - 86, cy + 10), elem.badge[:15], fill=self.pink_text, font=f_pill)
            draw.text((rx + 24, cy + 8), elem.label[:36], fill=self.text_dark, font=f_elem)
            lines = self._wrap_text(elem.subtext, 54)
            for l_i, line in enumerate(lines[:2]):
                draw.text((rx + 24, cy + 28 + l_i * 14), line, fill=self.text_muted, font=f_desc)

        # Center connecting bridge arrow
        cx = w // 2
        cy_bridge = start_y + col_h // 2
        draw.rounded_rectangle([cx - 40, cy_bridge - 20, cx + 40, cy_bridge + 20], radius=8, fill=self.pill_purple, outline=self.border_purple)
        draw.text((cx - 28, cy_bridge - 10), "Lungs ->", fill=self.dark_purple, font=f_pill)
        draw.text((cx - 32, cy_bridge + 4), "O2 Load", fill=self.primary_purple, font=f_pill)

    # 2. DATA STRUCTURE & MEMORY (e.g. Python Arrays, Java Arrays)
    def _draw_data_structure_memory(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_mono = self._get_font(13)
        f_val = self._get_font(14)
        f_lbl = self._get_font(11)
        f_pill = self._get_font(11)

        # Top Code Snippet / Operation Banner
        if spec.code_snippet:
            draw.rounded_rectangle([30, 100, w - 30, 138], radius=8, fill=self.pill_purple, outline=self.border_purple)
            draw.text((44, 110), f"Operation / Syntax:  {spec.code_snippet[:85]}", fill=self.dark_purple, font=f_mono)

        # Memory Grid
        elements = spec.elements[:6]
        box_w = 125
        box_h = 85
        gap = 14
        total_w = len(elements) * box_w + (len(elements) - 1) * gap
        start_x = (w - total_w) // 2
        start_y = 195

        for i, elem in enumerate(elements):
            x = start_x + i * (box_w + gap)

            # Hex Memory Address above cell
            addr = elem.badge or f"0x{1000 + i * 8:X}"
            draw.text((x + 28, start_y - 24), addr, fill=self.text_muted, font=f_lbl)

            # Contiguous Cell Box
            draw.rounded_rectangle([x, start_y, x + box_w, start_y + box_h], radius=10, fill="#FFFFFF", outline=self.primary_purple, width=3)

            # Value inside
            val_match = re.search(r"Value:\s*([^\|]+)", elem.subtext)
            display_val = val_match.group(1).strip() if val_match else elem.label
            draw.text((x + 18, start_y + 24), display_val[:14], fill=self.text_dark, font=f_val)

            # Data type badge inside cell
            type_match = re.search(r"Type:\s*([^\|]+)", elem.subtext)
            type_lbl = type_match.group(1).strip() if type_match else "item"
            draw.rounded_rectangle([x + 12, start_y + 54, x + box_w - 12, start_y + 74], radius=4, fill=self.pill_purple)
            draw.text((x + 24, start_y + 57), f"type: {type_lbl[:8]}", fill=self.dark_purple, font=f_lbl)

            # Positive index below
            draw.rounded_rectangle([x + 20, start_y + box_h + 10, x + box_w - 20, start_y + box_h + 32], radius=6, fill=self.blue_bg, outline=self.blue_border)
            draw.text((x + 36, start_y + box_h + 14), f"idx [{i}]", fill=self.blue_text, font=f_lbl)

            # Negative index below for Python
            if "python" in spec.topic.lower():
                neg_idx = -len(elements) + i
                draw.text((x + 40, start_y + box_h + 38), f"[{neg_idx}]", fill=self.text_muted, font=f_lbl)

        # Performance summary pill
        perf_y = start_y + box_h + 80
        draw.rounded_rectangle([40, perf_y, w - 40, perf_y + 44], radius=8, fill=self.green_bg, outline=self.green_border)
        draw.text((54, perf_y + 12), "Time Complexity:  Access: O(1) Constant  |  Append: O(1) Amortized  |  Search: O(n) Linear", fill=self.green_text, font=f_pill)

    # 3. FLOW / CYCLES / METABOLIC PATHWAYS (e.g. Water Cycle, Photosynthesis, Mitosis)
    def _draw_flow_or_cycle(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_stage = self._get_font(12)
        f_pill = self._get_font(10)
        f_desc = self._get_font(10)

        stages = spec.elements[:4]
        box_w = 410
        box_h = 100

        coords = [
            (36, 115),                 # Stage 1: Top-Left
            (w - box_w - 36, 115),     # Stage 2: Top-Right
            (w - box_w - 36, 255),     # Stage 3: Bottom-Right
            (36, 255),                 # Stage 4: Bottom-Left
        ]

        # Connective flow arrows
        draw.line([36 + box_w, 165, w - box_w - 36, 165], fill=self.border_purple, width=3)
        draw.line([w - box_w // 2 - 36, 215, w - box_w // 2 - 36, 255], fill=self.border_purple, width=3)
        draw.line([w - box_w - 36, 305, 36 + box_w, 305], fill=self.border_purple, width=3)
        draw.line([36 + box_w // 2, 255, 36 + box_w // 2, 215], fill=self.border_purple, width=3)

        colors_map = [
            (self.blue_bg, self.blue_border, self.blue_text),
            (self.orange_bg, self.orange_border, self.orange_text),
            (self.pink_bg, self.pink_border, self.pink_text),
            (self.green_bg, self.green_border, self.green_text),
        ]

        for idx, elem in enumerate(stages):
            if idx >= len(coords):
                break
            x, y = coords[idx]
            c_bg, c_border, c_text = colors_map[idx % len(colors_map)]

            draw.rounded_rectangle([x, y, x + box_w, y + box_h], radius=12, fill="#FFFFFF", outline=c_border, width=2)

            # Stage Badge
            badge_val = elem.badge or f"Stage {idx + 1}"
            draw.rounded_rectangle([x + 14, y + 10, x + 145, y + 30], radius=6, fill=c_bg)
            draw.text((x + 20, y + 13), badge_val[:18], fill=c_text, font=f_pill)

            # Title
            draw.text((x + 155, y + 12), elem.label[:36], fill=self.text_dark, font=f_stage)

            # Description
            lines = self._wrap_text(elem.subtext, 56)
            for l_i, line in enumerate(lines[:3]):
                draw.text((x + 18, y + 38 + l_i * 16), line, fill=self.text_body, font=f_desc)

        # Center Cycle Core Badge
        cx, cy = w // 2, 235
        draw.rounded_rectangle([cx - 75, cy - 24, cx + 75, cy + 24], radius=12, fill=self.pill_purple, outline=self.primary_purple, width=2)
        draw.text((cx - 55, cy - 14), "CONTINUOUS", fill=self.dark_purple, font=f_pill)
        draw.text((cx - 48, cy + 2), "CYCLE FLOW", fill=self.primary_purple, font=f_pill)

    # 4. TREE HIERARCHIES (e.g. Binary Search Tree)
    def _draw_tree_hierarchy(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_val = self._get_font(13)
        f_lbl = self._get_font(10)
        f_mono = self._get_font(11)

        rx, ry = w // 2, 160
        lx, ly = rx - 180, 250
        rx1, ry1 = rx + 180, 250
        llx, lly = lx - 90, 340
        lrx, lry = lx + 90, 340
        rrx, rry = rx1 + 90, 340

        edges = [
            ((rx, ry), (lx, ly), "< 50"),
            ((rx, ry), (rx1, ry1), "> 50"),
            ((lx, ly), (llx, lly), "< 30"),
            ((lx, ly), (lrx, lry), "> 30"),
            ((rx1, ry1), (rrx, rry), "> 70"),
        ]
        for p1, p2, lbl in edges:
            draw.line([p1[0], p1[1] + 20, p2[0], p2[1] - 20], fill=self.border_purple, width=3)
            mx, my = (p1[0] + p2[0]) // 2, (p1[1] + p2[1]) // 2
            draw.rounded_rectangle([mx - 24, my - 10, mx + 24, my + 10], radius=4, fill=self.pill_purple, outline=self.border_purple)
            draw.text((mx - 16, my - 7), lbl, fill=self.dark_purple, font=f_lbl)

        nodes = [
            (rx, ry, "50", "Root Node"),
            (lx, ly, "30", "Left Child"),
            (rx1, ry1, "70", "Right Child"),
            (llx, lly, "20", "Left Leaf"),
            (lrx, lry, "40", "Inner Leaf"),
            (rrx, rry, "85", "Right Leaf"),
        ]
        for x, y, val, desc in nodes:
            draw.ellipse([x - 28, y - 28, x + 28, y + 28], fill="#FFFFFF", outline=self.primary_purple, width=3)
            draw.text((x - 8, y - 8), val, fill=self.text_dark, font=f_val)
            draw.text((x - 24, y + 32), desc, fill=self.text_muted, font=f_lbl)

        # In-order traversal guidance banner
        draw.rounded_rectangle([40, 420, w - 40, 460], radius=8, fill=self.pill_purple, outline=self.border_purple)
        draw.text((54, 432), "In-Order Traversal (L -> Root -> R):  [20, 30, 40, 50, 70, 85]  ->  Produces Strictly Ascending Sorted Order", fill=self.dark_purple, font=f_mono)

    # 5. LAYERS STACK (e.g. Neural Networks, OSI Stack)
    def _draw_layers_stack(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_layer = self._get_font(13)
        f_desc = self._get_font(11)
        f_badge = self._get_font(10)

        layers = spec.elements[:4]
        box_w = 720
        box_h = 64
        start_x = (w - box_w) // 2
        start_y = 110

        colors_map = [
            (self.blue_bg, self.blue_border, self.blue_text),
            (self.pill_purple, self.border_purple, self.dark_purple),
            (self.orange_bg, self.orange_border, self.orange_text),
            (self.green_bg, self.green_border, self.green_text),
        ]

        for i, elem in enumerate(layers):
            y = start_y + i * (box_h + 14)
            c_bg, c_border, c_text = colors_map[i % len(colors_map)]

            draw.rounded_rectangle([start_x, y, start_x + box_w, y + box_h], radius=10, fill="#FFFFFF", outline=c_border, width=2)

            # Badge
            if elem.badge:
                draw.rounded_rectangle([start_x + 14, y + 18, start_x + 130, y + 46], radius=6, fill=c_bg)
                draw.text((start_x + 22, y + 26), elem.badge[:16], fill=c_text, font=f_badge)

            # Title
            draw.text((start_x + 145, y + 12), elem.label[:50], fill=self.text_dark, font=f_layer)

            # Description
            draw.text((start_x + 145, y + 36), elem.subtext[:88], fill=self.text_body, font=f_desc)

    # 6. COMPARISON MATRIX (e.g. Normalization 1NF-3NF, Newton's Laws)
    def _draw_comparison_matrix(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_title = self._get_font(13)
        f_desc = self._get_font(11)
        f_badge = self._get_font(10)

        items = spec.elements[:4]
        count = len(items)
        gap = 14
        card_w = (w - 60 - (count - 1) * gap) // count
        card_h = 340
        start_y = 115

        colors_map = [
            (self.blue_bg, self.blue_border, self.blue_text),
            (self.pill_purple, self.border_purple, self.dark_purple),
            (self.orange_bg, self.orange_border, self.orange_text),
            (self.green_bg, self.green_border, self.green_text),
        ]

        for idx, elem in enumerate(items):
            x = 30 + idx * (card_w + gap)
            c_bg, c_border, c_text = colors_map[idx % len(colors_map)]

            draw.rounded_rectangle([x, start_y, x + card_w, start_y + card_h], radius=12, fill="#FFFFFF", outline=c_border, width=2)

            # Header pill
            draw.rounded_rectangle([x + 12, start_y + 14, x + card_w - 12, start_y + 42], radius=6, fill=c_bg)
            draw.text((x + 20, start_y + 20), elem.badge or f"Level {idx + 1}", fill=c_text, font=f_badge)

            # Card title
            draw.text((x + 14, start_y + 54), elem.label[:24], fill=self.text_dark, font=f_title)

            # Description
            lines = self._wrap_text(elem.subtext, 28)
            for l_i, line in enumerate(lines[:9]):
                draw.text((x + 14, start_y + 85 + l_i * 18), line, fill=self.text_body, font=f_desc)

    # 7. CONCEPT BREAKDOWN
    def _draw_concept_breakdown(self, draw: ImageDraw.ImageDraw, spec: DiagramSpec):
        w = self.width
        f_title = self._get_font(13)
        f_desc = self._get_font(11)
        f_badge = self._get_font(10)

        items = spec.elements[:4]
        card_w = 410
        card_h = 135

        coords = [
            (36, 115),
            (w - card_w - 36, 115),
            (36, 265),
            (w - card_w - 36, 265),
        ]

        colors_map = [
            (self.blue_bg, self.blue_border, self.blue_text),
            (self.pill_purple, self.border_purple, self.dark_purple),
            (self.orange_bg, self.orange_border, self.orange_text),
            (self.green_bg, self.green_border, self.green_text),
        ]

        for idx, elem in enumerate(items):
            if idx >= len(coords):
                break
            x, y = coords[idx]
            c_bg, c_border, c_text = colors_map[idx % len(colors_map)]

            draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=12, fill="#FFFFFF", outline=c_border, width=2)
            draw.rounded_rectangle([x + 14, y + 12, x + 120, y + 36], radius=6, fill=c_bg)
            draw.text((x + 22, y + 17), elem.badge or f"Pillar {idx + 1}", fill=c_text, font=f_badge)

            draw.text((x + 130, y + 15), elem.label[:32], fill=self.text_dark, font=f_title)

            lines = self._wrap_text(elem.subtext, 54)
            for l_i, line in enumerate(lines[:4]):
                draw.text((x + 16, y + 48 + l_i * 18), line, fill=self.text_body, font=f_desc)

    def render_diagram(self, spec: DiagramSpec) -> str:
        """
        Renders a DiagramSpec and returns it as a base64 encoded PNG string.
        """
        img = Image.new("RGB", (self.width, self.height), color=self.bg_color)
        draw = ImageDraw.Draw(img)

        # 1. Header & Footer
        self._draw_header(draw, spec)
        self._draw_footer(draw, spec)

        # 2. Body based on category
        cat = spec.category
        if cat == "anatomy_system":
            self._draw_anatomy_system(draw, spec)
        elif cat == "data_structure_memory":
            self._draw_data_structure_memory(draw, spec)
        elif cat == "flow_or_cycle":
            self._draw_flow_or_cycle(draw, spec)
        elif cat == "tree_hierarchy":
            self._draw_tree_hierarchy(draw, spec)
        elif cat == "layers_stack":
            self._draw_layers_stack(draw, spec)
        elif cat == "comparison_matrix":
            self._draw_comparison_matrix(draw, spec)
        else:
            self._draw_concept_breakdown(draw, spec)

        # 3. Save to PNG base64
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        buf.seek(0)
        b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
        logger.info(f"Rendered dynamic 2D educational diagram for topic='{spec.topic}' category='{cat}' ({len(b64_str)} bytes)")
        return b64_str

    def render_educational_diagram(
        self,
        topic: str,
        prompt: Optional[str] = None,
        requirements: Optional[str] = None,
        context: Optional[str] = None
    ) -> str:
        """
        High-level wrapper: finds or synthesizes the best DiagramSpec for the topic/prompt/requirements,
        then renders it to base64 PNG.
        """
        spec = diagram_synthesizer.get_diagram_spec(
            topic=topic,
            prompt=prompt or "",
            requirements=requirements,
            context=context
        )
        return self.render_diagram(spec)

diagram_renderer = EducationalDiagramRenderer()
