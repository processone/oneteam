var EXPORTED_SYMBOLS = ["displayEditButton", "oldFormatEditMessageRegex",
                        "tryToConvertOldFormatEditMessage"];

ML.importMod("utils.js");


function highlightDiff (node1, node2) {
  /* find out the text differences between nodes node1 and node2,
   * the differences being highlighted in <span class="edit">,
   * for example,
   * node1 = "we live all in a <span class="yellow">yellow</span> submarine"
   * node2 = "We all live in a grey <span class="grey">submarine</span>"
   * htmlDiff(node1, node2) => (
   *   "We live <span class="edit">all</span> in a <span class="yellow"><span class="edit">yellow</span><span> submarine",
   *   "We <span class="edit">all</span> live in a <span class="edit">grey</span> <span class="grey">submarine</span>"
     )

     - turn spans class="edit" into textNodes
     - splits the text content of the nodes into arrays
     - finds out the diff between the arrays
     - insert the diffs into the nodes
   */
  var pattern = /\b/; // defines how to split the message into a strings array

  function _removeEditSpans(node) {
  // merges the content of span.edit into the parentNode, and remove span.edit
    var iterator = document.createNodeIterator(node, 1, {
        acceptNode: function(node) {
          return (node.tagName.toUpperCase() == "SPAN") && (node.className == "edit") ? 1 : 0;
        }
    }, true);
    var n;
    while ((n = iterator.nextNode())) {
      for (var i = 0; i < n.childNodes.length; i++)
        n.parentNode.insertBefore(n.childNodes[i], n);
      //n.nodeValue = ""; // unexpectedly, n.parentNode.removeChild(n) doesn't work properly
      n.parentNode.removeChild(n);
    }
    node.normalize();
  }

  function _split(node) {
    // split the textContent of node at spaces and html markups, returning an array of strings
    var res = [];
    var iterator = document.createNodeIterator(node, 4, {
        acceptNode: function() {return 1;}
    }, true);
    var n;
    while ((n = iterator.nextNode())) {
      res = res.concat(n.textContent.split(pattern));
    }
    return res;
  }

  function _diff (a1, a2) {
    var memo = []; // 2-dimensions tab to memoize results of lcs

    function lcs(x, y) {
      /* 0 <= x <= a1.length, 0 <= y <= a2.length
       * find out the longest common subsequence between a1.slice(0, x) and a2.slice(0, y)
       * and return the result as {
           w: the length of the LCS,
           b1: a boolean array (actually, a string containing 0 and 1, which is lighter)
               with true (1) if the corresponding word of a1 is in the LCS, false (0) else
           b2: idem for a2
         }
       */

      function zero(n) {
        //return a string of length n containing only 0
        if (n<=20)
          return (0).toFixed(n).substr(2);
        else {
          var s = zero(n >>> 1);
          return s + s + (n & 1 ? "0" : "");
        }
      }

      if (memo[x] == undefined)
        memo[x] = [];
      if (memo[x][y] == undefined) {
        if (x == 0)
          memo[x][y] = { b1: "", b2: zero(y), w: 0 }
        else if (y == 0)
          memo[x][y] = { b1: zero(x), b2: "", w: 0 }
        else if (a1[x-1] == a2[y-1]) {
          var m = lcs(x-1, y-1);
          memo[x][y] = { b1: m.b1 + "1", b2: m.b2 + "1", w:  m.w  + 1 };
        } else {
          var m1 = lcs(x, y-1),
              m2 = lcs(x-1, y);
          memo[x][y] = m1.w > m2.w ?
            { b1: m1.b1      , b2: m1.b2 + "0", w: m1.w } :
            { b1: m2.b1 + "0", b2: m2.b2      , w: m2.w } ;
        }
      }
      return memo[x][y];
    }

    return lcs(a1.length, a2.length);
  }

  function _unsplit(node, diffStr) {
    // given a node and diffStr found out by _diff,
    // modify node by adding <span class="edit"> markups at diverging parts of textContent
    var iterator = document.createNodeIterator(node, 4, {
        acceptNode: function() {return 1;}
    }, true);
    var i = 0, j, k, n;

    while ((n = iterator.nextNode())) {
      var text = n.textContent.split(pattern);
      j = 0;
      k = 0;
      while (k < text.length) {
        // looking for an undiverging sequence
        while (k < text.length && diffStr[i+k] == "1") k++;
        if (k>j) {
          n.parentNode.insertBefore(
            document.createTextNode(text.slice(j, k).join('')), n);
          j = k;
        }
        // looking for a diverging sequence
        while (k < text.length && diffStr[i+k] == "0") k++;
        if (k>j) {
          var span = node.ownerDocument.createElement("span");
          span.setAttribute("class", "edit");
          span.appendChild(node.ownerDocument.createTextNode(text.slice(j, k).join('')));
          n.parentNode.insertBefore(span, n);
          j = k;
        }
      }
      i += text.length;
      n.parentNode.removeChild(n);
    }
  }

  _removeEditSpans(node1);
  _removeEditSpans(node2);
  var diff = _diff(_split(node1), _split(node2));
  _unsplit(node1, diff.b1);
  _unsplit(node2, diff.b2);
}


function displayEditButton(body, message, xulNode) {
  // xulNode is used only to attach the tooltips to a xul element

  function mytooltip(htmlNode, text) {
    tooltip(htmlNode, xulNode, text);
  }

  var doc = body.ownerDocument;
  var rightDiv = message.rightDiv;

  var previous = doc.createElement("div");
  previous.setAttribute("class", "previousMessage");
  if (rightDiv.firstChild)
    rightDiv.insertBefore(previous, rightDiv.firstChild);
  else
    rightDiv.appendChild(previous);

  var next = doc.createElement("div");
  next.setAttribute("class", "nextMessage");
  rightDiv.insertBefore(next, rightDiv.firstChild);

  rightDiv.addEventListener("mouseover", function() {
    body.setAttribute("displayEdit", true);
  }, true);
  rightDiv.addEventListener("mouseout", function() {
    body.removeAttribute("displayEdit");
  }, true);

  var currentMsg = message;
  var nbVersions;

  function _displayOtherVersion(msg) {
    // display the version in msg of the message instead of that in currentMsg

    // the handles with doc.body.scrollTop just aims to keep the bottom of doc.body
    // at the same level, even if jth version's height <> ith version's height
    var messageHeight = body.clientHeight,
        scrollShift = doc.body.scrollTop - doc.body.scrollHeight - messageHeight;
    // scrollHeightEnlarger is appended to doc.body to prevent doc.body's bottom to be
    // over the chatpane-view's bottom: else, the scroll is automatically readjusted,
    // that takes time and the result is not fluid anymore
    var scrollHeightEnlarger = doc.createElement("div");
    scrollHeightEnlarger.setAttribute("style", "height: " + messageHeight + "px");

    highlightDiff(currentMsg.contentNode, msg.contentNode);

    // scrollHeightEnlarger is appended after highlightDiff, since highlightDiff may
    // take time: the complexity is O(n²) where n = number of words
    doc.body.appendChild(scrollHeightEnlarger);
    body.removeChild(currentMsg.contentNode);
    body.appendChild(msg.contentNode);

    doc.body.scrollTop = doc.body.scrollHeight + scrollShift;
    doc.body.removeChild(scrollHeightEnlarger);

    currentMsg = msg;
    _updateButtons();
  }

  function _displayPrevious() {
    _displayOtherVersion(currentMsg.previous);
  }
  function _displayNext() {
    _displayOtherVersion(currentMsg.editMessage);
  }

  function _updateButtons() {
    var tooltips = [];

    // 'See previous version' button
    if (currentMsg.previous) {
      previous.removeAttribute("disabled");
      previous.addEventListener("click", _displayPrevious, true);
      tooltips.push([true, previous, currentMsg.editCounter, currentMsg.previous.time]);
    } else {
      previous.setAttribute("disabled", "true");
      previous.removeEventListener("click", _displayPrevious, true);
      tooltips.push([false, previous, 1, currentMsg.time]);
    }

    // 'See next version' button
    if (currentMsg.editMessage) {
      next.removeAttribute("disabled");
      next.addEventListener("click", _displayNext, true);
      tooltips.push([true, next, currentMsg.editCounter ? currentMsg.editCounter+2 : 2,
                     currentMsg.editMessage.time]);
    } else {
      next.setAttribute("disabled", "true");
      next.removeEventListener("click", _displayNext, true);
      tooltips.push([false, next, nbVersions, currentMsg.time]);
    }

    for (var i = 0; i < tooltips.length; i++) {
      var [enabled, tooltip, version, timestamp] = tooltips[i];

      if (enabled)
        mytooltip(tooltip, _("See version {0} (from {1}), {2}", version, nbVersions,
                             readableTimestamp(timestamp)));
      else
        mytooltip(tooltip, _("This is version {0} (from {1}), {2}", version, nbVersions,
                             readableTimestamp(timestamp)));
    }
  }

  return {
    reload: function(msg) {
      // msg is supposed to be the last version of the message
      if (currentMsg == msg)
        return;
      nbVersions = msg.editCounter + 1;
      _displayOtherVersion(msg);
      _updateButtons();
    }
  }
}


var oldFormatEditMessageRegex = /^s\/([^\/]*)\/([^\/]*)\/\s*$/;

/*
 * tryToConvertOldFormatEditMessage(Message msg, Message lastMsg)
 * if msg is an old format edit message (i.e. looks like s/bad/good/)
 * and matches lastMsg, modifies msg as XEP-proposal compliant edit message
 * (i.e. with a replaceMessageId);
*/

function tryToConvertOldFormatEditMessage(msg, lastMsg) {
  var match, matchHtml;
  if (lastMsg
    && (match     = oldFormatEditMessageRegex.exec(msg.text))
    && (matchHtml = oldFormatEditMessageRegex.exec(msg.html))
    && lastMsg.text.indexOf(match[1]    ) >= 0
    && lastMsg.html.indexOf(matchHtml[1]) >= 0
  ) {
    msg.replaceMessageId = lastMsg.messageId;
    msg.setContent(
      lastMsg.text.replace(match[1]    , match[2]    ),
      lastMsg.html.replace(matchHtml[1], matchHtml[2])
    );
  }
}
