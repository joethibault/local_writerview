// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Writer View DOM manipulation module.
 *
 * @module     local_writerview/writerview
 * @copyright  2026 Cursive Technology
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

define([], function() {
    'use strict';

    var config = null;
    var wordCountInterval = null;

    function init(cfg) {
        config = cfg;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    function setup() {
        document.body.classList.add('writerview-active');
        waitForEditor(function() {
            rearrangeDOM();
            startWordCount();
        });
    }

    function waitForEditor(callback) {
        var attempts = 0;
        var maxAttempts = 100;
        var interval = setInterval(function() {
            attempts++;
            var editor = document.querySelector('.tox-tinymce');
            if (editor) {
                clearInterval(interval);
                callback(editor);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                window.console.warn('[WriterView] TinyMCE editor not found after 10s. Aborting.');
            }
        }, 100);
    }

    function rearrangeDOM() {
        var form = document.querySelector('#page-content div[role="main"] .mform');
        if (!form) {
            window.console.warn('[WriterView] .mform not found. Aborting.');
            return;
        }

        // Tag existing children — do NOT move them (breaks TinyMCE iframe).
        var children = Array.from(form.children);
        children.forEach(function(child) {
            if (child.nodeType === 1) {
                child.classList.add('writerview-editor-child');
            }
        });

        form.appendChild(buildSidebar());
        hideOriginalDescription();
    }

    function buildSidebar() {
        var sidebar = document.createElement('div');
        sidebar.className = 'writerview-sidebar';
        sidebar.setAttribute('role', 'complementary');
        sidebar.setAttribute('aria-label', config.strings.arialabel);

        // Edge toggle button (positioned absolutely on the sidebar border).
        var toggleBtn = document.createElement('button');
        toggleBtn.className = 'wv-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.setAttribute('aria-label', config.strings.togglesidebar);
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.innerHTML = chevronRight();
        toggleBtn.addEventListener('click', function() {
            var isCollapsed = sidebar.classList.toggle('collapsed');
            toggleBtn.innerHTML = isCollapsed ? chevronLeft() : chevronRight();
            toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
        });
        sidebar.appendChild(toggleBtn);

        // Content.
        var content = document.createElement('div');
        content.className = 'wv-sidebar-body';

        // Word count — top, most visible.
        content.appendChild(buildWordCountCard());

        // Status badge.
        content.appendChild(buildStatusCard());

        // Student info.
        content.appendChild(buildCard(
            config.strings.studentinfo,
            config.studentName,
            'user'
        ));

        // Assignment description.
        var descCard = buildCard(config.strings.description, '', 'doc');
        descCard.querySelector('.wv-card-body').innerHTML = config.description;
        content.appendChild(descCard);

        // Rubric (collapsible).
        if (config.rubricHtml) {
            content.appendChild(buildRubricCard());
        }

        sidebar.appendChild(content);
        return sidebar;
    }

    function buildWordCountCard() {
        var card = document.createElement('div');
        card.className = 'wv-card wv-wordcount-card';

        var label = document.createElement('div');
        label.className = 'wv-wordcount-label';
        label.textContent = config.strings.wordcount;

        var value = document.createElement('div');
        value.className = 'wv-wordcount-value';
        value.id = 'writerview-wordcount';
        value.textContent = '0';

        card.appendChild(label);
        card.appendChild(value);
        return card;
    }

    function buildStatusCard() {
        var card = document.createElement('div');
        card.className = 'wv-card wv-status-card';

        var label = document.createElement('div');
        label.className = 'wv-card-label';
        label.textContent = config.strings.status;

        var badge = document.createElement('span');
        badge.className = 'wv-status-badge wv-status-' + config.submissionStatus;
        badge.textContent = formatStatus(config.submissionStatus);

        card.appendChild(label);
        card.appendChild(badge);
        return card;
    }

    function buildCard(title, text, icon) {
        var card = document.createElement('div');
        card.className = 'wv-card';

        var label = document.createElement('div');
        label.className = 'wv-card-label';
        label.textContent = title;

        var body = document.createElement('div');
        body.className = 'wv-card-body';
        if (text) {
            body.textContent = text;
        }

        card.appendChild(label);
        card.appendChild(body);
        return card;
    }

    function buildRubricCard() {
        var card = document.createElement('div');
        card.className = 'wv-card wv-rubric-card';

        var headerRow = document.createElement('div');
        headerRow.className = 'wv-rubric-header';

        var label = document.createElement('div');
        label.className = 'wv-card-label';
        label.textContent = config.strings.rubric;

        var expandBtn = document.createElement('button');
        expandBtn.className = 'wv-rubric-toggle';
        expandBtn.type = 'button';
        expandBtn.textContent = config.strings.show;
        expandBtn.setAttribute('aria-expanded', 'false');

        headerRow.appendChild(label);
        headerRow.appendChild(expandBtn);

        var body = document.createElement('div');
        body.className = 'wv-rubric-body';
        body.style.display = 'none';
        body.innerHTML = config.rubricHtml;

        expandBtn.addEventListener('click', function() {
            var isVisible = body.style.display !== 'none';
            body.style.display = isVisible ? 'none' : 'block';
            expandBtn.textContent = isVisible ? config.strings.show : config.strings.hide;
            expandBtn.setAttribute('aria-expanded', String(!isVisible));
        });

        card.appendChild(headerRow);
        card.appendChild(body);
        return card;
    }

    function formatStatus(status) {
        var statusMap = {
            'new': config.strings.statusnew,
            'draft': config.strings.statusdraft,
            'submitted': config.strings.statussubmitted,
            'reopened': config.strings.statusreopened
        };
        return statusMap[status] || status;
    }

    function chevronLeft() {
        return '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">' +
            '<path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>';
    }

    function chevronRight() {
        return '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">' +
            '<path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>';
    }

    function hideOriginalDescription() {
        ['.activity-description', '#intro'].forEach(function(sel) {
            var el = document.querySelector(sel);
            if (el) {
                el.classList.add('writerview-hidden-original');
            }
        });
    }

    function startWordCount() {
        function updateCount() {
            var iframe = document.querySelector('.tox-tinymce iframe');
            if (!iframe || !iframe.contentDocument) {
                return;
            }
            var body = iframe.contentDocument.body;
            if (!body) {
                return;
            }
            var text = body.innerText || body.textContent || '';
            var count = countWords(text);
            var display = document.getElementById('writerview-wordcount');
            if (display) {
                display.textContent = count;
            }
        }

        updateCount();
        wordCountInterval = setInterval(updateCount, 2000);
        tryAttachEditorListener(updateCount);
    }

    function tryAttachEditorListener(updateFn) {
        var iframe = document.querySelector('.tox-tinymce iframe');
        if (!iframe || !iframe.contentDocument || !iframe.contentDocument.body) {
            return;
        }
        iframe.contentDocument.body.addEventListener('input', updateFn);
    }

    function countWords(text) {
        var trimmed = text.trim();
        if (trimmed.length === 0) {
            return 0;
        }
        return trimmed.split(/\s+/).length;
    }

    return {
        init: init
    };
});
