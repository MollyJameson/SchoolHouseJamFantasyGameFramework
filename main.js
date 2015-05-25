
var default_spreadsheet_test_data = "1FZRdBHB_vE_OqBq_NpHyDg__PebF7_lD6hy1FGP4XLM";

function getUrlParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++)
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam)
        {
            return sParameterName[1];
        }
    }
    return undefined;
}

var spreadsheet_id = getUrlParameter("spreadsheet_id");
if (spreadsheet_id == undefined)
{
    alert("spreadsheet_id not found in URL, using default.");
    spreadsheet_id = default_spreadsheet_test_data;
}

// by default we sort by weekly scores
var sort_on_total = false;
var sort_on_val = getUrlParameter("sortOn");
if (sort_on_val != undefined)
{
    if (sort_on_val == "total")
    {
        sort_on_total = true;
    }
}

var spData = null;
var teamData = null;
var gameData = null;

// You can only load one worksheet at a time :( and we're "ready" when all 3 have come back.
// this loads the first worksheet.
$.getScript("https://spreadsheets.google.com/feeds/cells/" + spreadsheet_id + "/1/public/values?alt=json-in-script&callback=OnGoogleDocsCallback", function (){});
$.getScript("https://spreadsheets.google.com/feeds/cells/" + spreadsheet_id + "/2/public/values?alt=json-in-script&callback=OnGoogleDocsCallbackTeamWorksheet", function (){});
$.getScript("https://spreadsheets.google.com/feeds/cells/" + spreadsheet_id + "/3/public/values?alt=json-in-script&callback=OnGoogleDocsCallbackGameDataWorksheet", function (){});

// these are mostly just arrays not objects for sorting regions
var m_StudentData = [];
var m_TeamData = [];
var m_FlavorData = [];

var m_GameTitle = "NAME OF THE GAME.";
var m_GameSubtitle = "PERIOD WHATEVER.";
var m_WeekName = "ROUND"; // in case you want to call weeks 'rounds' or something else
var m_TeamType = "crew"; // so you can call your teams whatever you want
var m_IndividualSectionHeader = "individual rankings";
var m_TeamSectionHeader = "guild rankings";
var m_LineGraphHeader = "the journey thus far";
/*
"Student Object"
{
"Name":String
"CurrTotal":int
"TeamName":String
"WeeklyTotal":Array of ints
WeeklyScore:int
}
*/
/*
"Team Object"
{
"TeamName":String
"Color":Uint
"CurrTotal":int
WeeklyScore:int
"WeeklyIndividualScores":Array of ints
"WeeklyTeamScores":Array of ints
"Members":Array of References to "Student" objects,
"Inventory":int
}
*/


function OnGoogleDocsCallback(json)
{
    spData = json.feed.entry;

    if (spData && teamData && gameData)
    {
        readData($("#data"));
    }
}

function OnGoogleDocsCallbackTeamWorksheet(json)
{
    teamData = json.feed.entry;
    if (spData && teamData && gameData)
    {
        readData($("#data"));
    }
}

function OnGoogleDocsCallbackGameDataWorksheet(json)
{
    gameData = json.feed.entry;
    if (spData && teamData && gameData)
    {
        readData($("#data"));
    }
}

function isNumber(n)
{
    return !isNaN(parseFloat(n)) && isFinite(n);
}

var m_HighestTeamScore = 0;
var m_HighestTeamScoreIndex = 0;
var m_WeekNumber = 0;
function AddTeam(rowData)
{
    var team_obj = {};
    team_obj.TeamName = rowData[0];
    team_obj.Color = rowData[1];
    team_obj.Inventory = rowData[2];
    team_obj.CurrTotal = parseFloat(rowData[3]);
    team_obj.WeeklyScore = 0;

    if (team_obj.CurrTotal > m_HighestTeamScore)
    {
        m_HighestTeamScore = team_obj.CurrTotal;
        m_HighestTeamScoreIndex = m_TeamData.length;
    }

    team_obj.Members = [];

    var scores_array = [];
    var initialColumn = 5;
    var columnSpan = 4; // how many columns does one week's data take up
    var meatyColumn = 3; // which column in the columnSpan is the meatiest
    for (var i = initialColumn; i < rowData.length; i+=columnSpan)
    {
        if (isNumber(rowData[i+meatyColumn]))
        {
            scores_array.push(rowData[i+meatyColumn]);
        }
    }
    team_obj.ScoreHistory = scores_array;

    m_TeamData.push(team_obj);
}

// Game Title, Game Subtitle, Round Type, Individual Section Header, Team Section Header, Line Graph Section Header
// Can be parsed fuggin whenever <3
function parseGameData()
{
    var data = gameData;
    var initialRow = 1; // not 0-based
    var initialColumn = 2; // not 0-based

    var hitTracker = 0;
    for (var r=initialRow; r<data.length; r++) {
        var cell = data[r]["gs$cell"];
        var val = cell["$t"];

        if (cell.col == initialColumn) {
            switch(hitTracker) {
                case 0:
                m_GameTitle = val;
                break;
                case 1:
                m_GameSubtitle = val;
                break;
                case 2:
                m_WeekName = val;
                break;
                case 3:
                m_IndividualSectionHeader = val;
                break;
                case 4:
                m_TeamSectionHeader = val;
                break;
                case 5:
                m_LineGraphHeader = val;
                break;
            }
            hitTracker++;
            //alert(val);
        }
    }

}

function parseFlavorData()
{
    var data = spData;
    var initialRow = 1; // not 0-based
    var initialColumn = 4; // not 0-based

    for (var r=initialRow; r<data.length; r++) {
        var cell = data[r]["gs$cell"];
        var val = cell["$t"];

        if (cell.row > initialRow+1) break; // weird hack lol sorry -sean 5/24/15 2:25 pm

        if (cell.col >= initialColumn) {
            m_FlavorData[cell.col-initialColumn] = val;
        } else {
            //alert("skipped " + cell.row + " " + cell.col);
        }
    }

}
// Team Name,	Team Color,	Notes Shield Inventory,	Team coins total,,		1 actions descriptions,	1 ptschanged,	1 indvidual pts combined up to this week,	1 team pts,
// Students data must be parsed first
function parseTeamData()
{
    var data = teamData;
    var rowData = [];
    var row = 0;

    // Skip the intro stuff
    for (var r = 2; r < data.length; r++)
    {
        var cell = data[r]["gs$cell"];
        var val = cell["$t"];
        if (cell.col == 1)
        {
            if (row > 0)
            {
                AddTeam(rowData);
            }
            rowData = [];
            row++;
        }
        //rowData.push(val);
        rowData[cell.col-1] = val;
    }
    AddTeam(rowData);

    // populate the members
    // create a dictionary of the members

    // sot by name
    var TeamDictionary = {};
    var num_teams = m_TeamData.length;
    for (var m = 0; m < num_teams; ++m)
    {
        var team = m_TeamData[m];
        TeamDictionary[team.TeamName] = team;
    }

    var num_students = m_StudentData.length;
    for (var k = 0; k < num_students; ++k)
    {
        var student = m_StudentData[k];
        student.WeeklyScore = 0;
        if (student.WeeklyTotals.length > m_WeekNumber)
        {
            student.WeeklyScore = student.WeeklyTotals[m_WeekNumber];
        }
        var team = TeamDictionary[student.TeamName];

        team.Members.push(student);

        team.WeeklyScore += parseFloat(student.WeeklyScore);
    }
    
    $(".winner-color-bg").css("background-color", m_TeamData[m_HighestTeamScoreIndex].Color);
	//$('#jqxChart').jqxChart({backgroundColor: m_TeamData[m_HighestTeamScoreIndex].Color});
}

function AddStudent(rowData)
{
    //Student name	Team Name	Total Pts	1	2
    var student_obj = {};
    student_obj.Name = rowData[0];
    student_obj.TeamName = rowData[1];

    if (isNumber(rowData[2]))
    {
        student_obj.CurrTotal = parseFloat(rowData[2]);
    }
    else
    {
        student_obj.CurrTotal = 0;
    }
    var scores_array = [];
    for (var i = 3; i < rowData.length; i++)
    {
        if (isNumber(rowData[i]))
        {
            scores_array.push(rowData[i]);
        }
    }

    // set the week based on the furthest students progress
    if (scores_array.length > m_WeekNumber + 1)
    {
        m_WeekNumber = scores_array.length - 1;
    }

    student_obj.WeeklyTotals = scores_array;
    m_StudentData.push(student_obj);
}

function SortOnCurrTotal(a, b)
{
    if (a.CurrTotal < b.CurrTotal)
    {
        return -1;
    }
    else if (a.CurrTotal > b.CurrTotal)
    {
        return 1;
    }
    return 0;
}

function SortOnWeekly(a, b)
{
    if (a.WeeklyScore < b.WeeklyScore)
    {
        return -1;
    }
    else if (a.WeeklyScore > b.WeeklyScore)
    {
        return 1;
    }
    return 0;
}

function getTeamColorByName(teamName)
{
    var num_teams = m_TeamData.length;
    for (var i = 0; i < num_teams; ++i)
    {
        if (m_TeamData[i].TeamName == teamName)
        {
            return m_TeamData[i].Color;
        }
    }
    return 0;
}

// set the week display
function setGameInfo() {
    var parent_elem = $("#InsertGameInfoHere");

    parent_elem.append($("<div class='game-title'>" + m_GameTitle + "</div>"));
    if (m_GameSubtitle != "") {
        parent_elem.append($("<div class='game-subtitle'>" + m_GameSubtitle + "</div>"));
    }
    parent_elem.append($("<div class='week-display'>" + m_WeekName + " " + (m_WeekNumber+1) + ".</div>"));

    var flavorOfTheWeek = m_FlavorData[m_WeekNumber];
    if (flavorOfTheWeek == null || flavorOfTheWeek == "") {
        flavorOfTheWeek = "Welcome to a new week...";
    }
    $("#InsertFlavorTextHere").replaceWith("<div class='week-summary'>" + flavorOfTheWeek + "</div>");
    $("#InsertIndividualSectionHere").replaceWith("<div class='section-header'>--- " + m_IndividualSectionHeader + " ---</div>");
    $("#InsertTeamSectionHere").replaceWith("<div class='section-header'>--- " + m_TeamSectionHeader + " ---</div>");
    $("#InsertLineGraphHere").replaceWith("<div class='section-header'>--- " + m_LineGraphHeader + " ---</div>");
}

// fill in the dots that keep track of week progress and previous victories
function fillInTheDots() {
    var parent_elem = $("#InsertDotsHere");
    var class_pastweek = "egg-hatched";
    var class_futureweek = "egg-unhatched";
    var dotsPerRow = 8;
    var totalWeeksInGame = 16;

    var rowCounter = 0;
    for (var i=0; i<totalWeeksInGame; i++)
    {
        var rowStart = "";
        var rowEnd = "";

        if (rowCounter%dotsPerRow == 0) rowStart = "<tr>";
        if (rowCounter%dotsPerRow == dotsPerRow-1) rowEnd = "</tr>";
        rowCounter++;

        var chosenColor = "#333333";

        if (i<m_WeekNumber) {
            var highestScoreOfTheWeek = 0;
            for (var j=0; j<m_TeamData.length; j++) {
                var teamData = m_TeamData[j];
                if (teamData.ScoreHistory[i] > highestScoreOfTheWeek) {
                    highestScoreOfTheWeek = teamData.ScoreHistory[i];
                    chosenColor = getTeamColorByName(teamData.TeamName)
                }
            }
        }

        if (rowStart != "") parent_elem.append($(rowStart));
        var individual_elem = $("<td><div class='egg-hatched' style='background-color:" + chosenColor + "'></div></td>");
        parent_elem.append(individual_elem);
        if (rowEnd != "") parent_elem.append($(rowEnd));
    }
}

function buildIndividualRankings()
{
    var parent_elem = $("#InsertPlayerInfoHere");
    var num_students = m_StudentData.length;
    if (sort_on_total)
    {
        m_StudentData.sort(SortOnCurrTotal);
    }
    else
    {
        m_StudentData.sort(SortOnWeekly);
    }
    for (var i = 0; i < num_students; ++i)
    {
        var student = m_StudentData[i];

        var bg_color = getTeamColorByName(student.TeamName);
        var individual_elem = $(
            "<div class='player-info-group'>\
    <div class='team-indicator' style ='background-color:" + bg_color + "'></div>\
    <div>\
        <span class='player-name'>" + student.Name +"</span>\
        <span class='player-team'>" + student.TeamName +"</span>\
        <br>\
        <span class='player-score'>" + student.CurrTotal + " </span>\
        <span class='player-delta'>// (+" + student.WeeklyScore + ")</span>\
    </div>\
</div>"
        );

        parent_elem.prepend(individual_elem);
    }
}

function BulidClanRankings()
{
    var parent_elem = $("#InsertGroupInfoHere");
    var num_teams = m_TeamData.length;

    if (sort_on_total)
    {
        m_TeamData.sort(SortOnCurrTotal);
    }
    else
    {
        m_TeamData.sort(SortOnWeekly);
    }
    for (var i = 0; i < num_teams; ++i)
    {
        var team = m_TeamData[i];

        var built_html = "<div class='team-info-group'>\
    	<div class='team-indicator-big' style ='background-color:" + team.Color + "''></div>\
    	<div>\
    		<span class='team-name'>"+team.TeamName+"</span><br>\
    		<span class='team-score'>" + team.CurrTotal+" </span>\
    		<span class='team-delta'>(+"+ team.WeeklyScore +").</span><br>\
    		<span class='team-shields'>shields: "+team.Inventory +".</span><br>";

        var num_students = team.Members.length;
        for( var j = 0; j < num_students; ++j )
        {
            var student = team.Members[j];

            built_html += "<span class='team-member-info'>"+ student.Name + " " + student.CurrTotal +"</span>"
            built_html += "<span class='team-member-delta'>(+" + student.WeeklyScore + ").</span><br>";
        }

        built_html +=  "</div>\
                        </div><br>";
        var individual_elem = $(built_html);

        parent_elem.prepend(individual_elem);

        var elem_height = individual_elem.height();
        // basically < 4 names for our nondynamic setup
        var min_height = 337;
        if (elem_height < min_height)
        {
            individual_elem.css("height", min_height + "px");
        }
    }
}

function buildLineChart()
{
    var data = [];
    var series_data = [];

    for (var i = 0; i < m_WeekNumber; ++i)
    {
        data[i] = { x: i };
    }
    //{ "x": 1, "y1": 1, "y2": 8 },
    // { dataField: 'y1', displayText: 'Line 1', color: '#FF00FF' },
    var num_teams = m_TeamData.length;
    for (var i = 0; i < num_teams; ++i)
    {
        var team = m_TeamData[i];
        var score_count = team.ScoreHistory.length;

        for (var j = 0; j < score_count && j < m_WeekNumber; ++j)
        {
            data[j][team.TeamName] = team.ScoreHistory[j];
        }

        var team_info = {};
        team_info.dataField = team.TeamName;
        team_info.displayText = team.TeamName;
        team_info.color = team.Color;
        series_data.push(team_info);
		series_data.push({lineWidth:10});
    }

    // prepare jqxChart settings
    var settings = {
        source: data,
        title: "",//"Weekly Scores",
        showLegend: false,
        description: "",
        /*padding: { 
            left: 1, top: 1, right: 1, botttom: 1
        },*/
         padding: {
             left: 12,
             top: 12,
             right: 12,
             bottom: 12
         },
         showBorderLine: false,
         showToolTips: false,
         /*backgroundColor: m_TeamData[m_HighestTeamScoreIndex].Color,*/

         /*xAxis: {
            visible: false,
            gridLines: { 
                visible: false,
                step: 3,
                color: '#888888'
            }
        },*/

        categoryAxis:
        {
            dataField: 'x'
        },
        valueAxis:
        {
            visible: true,
            title: { text: 'Score' },
            gridLines: { 
                visible: false,
                step: 3,
                color: '#888888'
            }
        },
        seriesGroups:
            [
            {
                type: 'line',
                xAxis:
                {
                    unitInterval: 2,
                    minValue: 0,
                    maxValue: 16,

                    tickMarks: {
                        visible: true,
                        step: 0.5,
                        color: '#333333',
                        lineWidth: 6,
                        size: 12
                    },

                    gridLines: { 
                        visible: false,
                        step: 3,
                        color: '#888888'
                    },

                    line: {
                        lineWidth: 6,
                        color: '#333333'
                    }
                },

                valueAxis:
                {
                    unitInterval: 100,
                    /*minValue: 0,
                    maxValue: 300,*/

                    tickMarks: {
                        visible: true,
                        step: 0.5,
                        color: '#333333',
                        lineWidth: 6,
                        size: 12
                    },

                    gridLines: { 
                        visible: false,
                        step: 3,
                        color: '#888888'
                    },

                     line: {
                        lineWidth: 6,
                        color: '#333333'
                    }
                },
                lineWidth: 8,
                series: series_data
            }
            ]
    };


    $('#jqxChart').jqxChart(settings);
}

function readData(parent)
{
    var data = spData;
    var rowData = [];
    var row = 0;

    // Skip the intro stuff
    for (var r = 2; r < data.length; r++)
    {
        var cell = data[r]["gs$cell"];
        var val = cell["$t"];
        // push in the entire previous row ( that rowData has had pushed into it. )
        if (cell.col == 1)
        {
            if (row > 1)
            {
                AddStudent(rowData);
            }
            rowData = [];
            row++;
        }
        rowData.push(val);
    }
    AddStudent(rowData);

    parseTeamData();
    parseGameData();
	parseFlavorData();
    buildIndividualRankings();
    BulidClanRankings();
    fillInTheDots();
    setGameInfo();
    buildLineChart();
}

$(document).ready(function ()
{
    // We need to wait until "OnGoogleDocsCallback' is called, this just says that the JS is loaded.
});